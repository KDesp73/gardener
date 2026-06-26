import os
import sqlite3
import json
import logging
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

logger = logging.getLogger("listener.db")

class Database:
    def __init__(self, url: str, auth_token: str | None = None):
        self.url = url
        self.auth_token = auth_token
        self._conn: sqlite3.Connection | None = None
        self._http_session = None

    def init(self):
        parsed = urlparse(self.url)
        if parsed.scheme in ("file", ""):
            self._init_sqlite()
        else:
            self._init_http()
        self._ensure_schema()

    # ── SQLite backend ──────────────────────────────────────────────────

    def _init_sqlite(self):
        path = self.url.removeprefix("file:")
        path = os.path.expanduser(path)
        # Resolve relative to the listener/ directory
        if not os.path.isabs(path):
            path = str(Path(__file__).parent / path)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        logger.info("Using SQLite: %s", path)

    def _sqlite_execute(self, sql: str, params: tuple = ()):
        with self._conn:
            return self._conn.execute(sql, params)

    def _sqlite_execute_many(self, sql: str, rows: list[tuple]):
        with self._conn:
            self._conn.executemany(sql, rows)

    # ── Turso HTTP backend ──────────────────────────────────────────────

    def _init_http(self):
        import requests as req
        # Turso gives libsql:// URLs; HTTP API lives at https://
        http_url = self.url.replace("libsql://", "https://", 1)
        self._http_url = http_url.rstrip("/")
        self._http_session = req.Session()
        self._http_session.headers.update({
            "Content-Type": "application/json",
        })
        if self.auth_token:
            self._http_session.headers["Authorization"] = f"Bearer {self.auth_token}"
        logger.info("Using Turso HTTP: %s", http_url)

    def _http_execute(self, sql: str, params: tuple = ()):
        def to_arg(v):
            if v is None:
                return {"type": "null"}
            if isinstance(v, bool):
                return {"type": "integer", "value": "1" if v else "0"}
            if isinstance(v, int):
                return {"type": "integer", "value": str(v)}
            if isinstance(v, float):
                return {"type": "real", "value": str(v)}
            return {"type": "text", "value": str(v)}

        body = {
            "requests": [
                {
                    "type": "execute",
                    "stmt": {"sql": sql, "args": [to_arg(p) for p in params]},
                }
            ]
        }
        resp = self._http_session.post(f"{self._http_url}/v2/pipeline", json=body)
        resp.raise_for_status()

    def _http_execute_many(self, sql: str, rows: list[tuple]):
        # falls back to individual executes for simplicity
        for row in rows:
            self._http_execute(sql, row)

    # ── Execute dispatch ────────────────────────────────────────────────

    def execute(self, sql: str, params: tuple = ()):
        if self._conn:
            self._sqlite_execute(sql, params)
        else:
            self._http_execute(sql, params)

    def execute_many(self, sql: str, rows: list[tuple]):
        if self._conn:
            self._sqlite_execute_many(sql, rows)
        else:
            self._http_execute_many(sql, rows)

    # ── Schema ──────────────────────────────────────────────────────────

    def _ensure_schema(self):
        self.execute("""
            CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                mqtt_host TEXT DEFAULT '',
                last_seen TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        self.execute("""
            CREATE TABLE IF NOT EXISTS zones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL REFERENCES devices(id),
                zone_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                soil_pin INTEGER DEFAULT 0,
                relay_pin INTEGER DEFAULT 0,
                dry_threshold INTEGER DEFAULT 1500,
                wet_threshold INTEGER DEFAULT 3000,
                max_run_sec INTEGER DEFAULT 60,
                schedule_on INTEGER DEFAULT 420,
                schedule_off INTEGER DEFAULT 480,
                sensor_type TEXT NOT NULL DEFAULT 'capacitive',
                enabled INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                UNIQUE(device_id, zone_id)
            )
        """)
        self.execute("""
            CREATE TABLE IF NOT EXISTS latest_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                zone_id INTEGER,
                sensor_type TEXT NOT NULL,
                value REAL,
                unit TEXT DEFAULT '',
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)
        self.execute("""
            CREATE TABLE IF NOT EXISTS readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                zone_id INTEGER,
                sensor_type TEXT NOT NULL,
                value REAL NOT NULL,
                unit TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        # Migration: add sensor_type to zones
        try:
            self.execute("ALTER TABLE zones ADD COLUMN sensor_type TEXT NOT NULL DEFAULT 'capacitive'")
        except Exception:
            pass

    # ── Data helpers ────────────────────────────────────────────────────

    def save_reading(self, device_id: str, zone_id: int | None, sensor_type: str, value: float, unit: str = ""):
        logger.debug("save reading %s/%s/%s = %s %s", device_id, zone_id, sensor_type, value, unit)
        # Upsert latest_readings: try update first, insert if row missing
        if self._conn:
            cursor = self._conn.execute(
                "UPDATE latest_readings SET value = ?, unit = ?, updated_at = datetime('now') "
                "WHERE device_id = ? AND IFNULL(zone_id, -1) = IFNULL(?, -1) AND sensor_type = ?",
                (value, unit, device_id, zone_id, sensor_type),
            )
            if cursor.rowcount == 0:
                self._conn.execute(
                    "INSERT INTO latest_readings (device_id, zone_id, sensor_type, value, unit) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (device_id, zone_id, sensor_type, value, unit),
                )
        else:
            self._http_execute(
                "INSERT OR IGNORE INTO latest_readings (device_id, zone_id, sensor_type, value, unit) "
                "VALUES (?, ?, ?, ?, ?)",
                (device_id, zone_id, sensor_type, value, unit),
            )
            self._http_execute(
                "UPDATE latest_readings SET value = ?, unit = ?, updated_at = datetime('now') "
                "WHERE device_id = ? AND sensor_type = ? AND (zone_id = ? OR (zone_id IS NULL AND ? IS NULL))",
                (value, unit, device_id, sensor_type, zone_id, zone_id),
            )

        self.execute(
            "INSERT INTO readings (device_id, zone_id, sensor_type, value, unit) VALUES (?, ?, ?, ?, ?)",
            (device_id, zone_id, sensor_type, value, unit),
        )

    def upsert_device(self, device_id: str, name: str | None = None):
        logger.debug("upsert device %s", device_id)
        self.execute(
            "INSERT INTO devices (id, name, last_seen) VALUES (?, ?, datetime('now')) "
            "ON CONFLICT (id) DO UPDATE SET "
            "name = COALESCE(NULLIF(?, ''), devices.name), last_seen = datetime('now')",
            (device_id, name or device_id, name or device_id),
        )

    def close(self):
        if self._conn:
            self._conn.close()
