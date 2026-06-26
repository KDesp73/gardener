"""
Gardener MQTT Listener — persists all device data to the shared database.

Runs as a long-lived process subscribing to all gardener MQTT topics
and writing readings into Turso / SQLite so no data is lost when the
monitor web UI is inactive.

Usage:
    python -m listener
"""

import os
import re
import json
import logging
import signal
import sys
import time
from pathlib import Path

import paho.mqtt.client as mqtt

from .db import Database

# ── Config ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("listener")

def env_str(key: str, default: str = "") -> str:
    return os.environ.get(key, default)

def env_int(key: str, default: int = 0) -> int:
    try:
        return int(os.environ.get(key, str(default)))
    except (ValueError, TypeError):
        return default

# ── Globals ─────────────────────────────────────────────────────────────────

db: Database | None = None
running = True

MQTT_TOPICS = [
    ("gardener/+/env", 0),
    ("gardener/+/zone/+/soil", 0),
    ("gardener/+/status", 0),
    ("gardener/+/announce", 0),
    ("gardener/+/zone/+/water", 0),
]

TOPIC_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"^gardener/([^/]+)/env$"), "env"),
    (re.compile(r"^gardener/([^/]+)/zone/(\d+)/soil$"), "soil"),
    (re.compile(r"^gardener/([^/]+)/status$"), "status"),
    (re.compile(r"^gardener/([^/]+)/announce$"), "announce"),
    (re.compile(r"^gardener/([^/]+)/zone/(\d+)/water$"), "water"),
]

# Optionally restrict to specific device IDs
FILTER_IDS: set[str] | None = None


# ── MQTT callbacks ──────────────────────────────────────────────────────────

def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        logger.info("Connected to MQTT broker")
        for topic, qos in MQTT_TOPICS:
            client.subscribe(topic, qos)
            logger.info("Subscribed: %s", topic)
    else:
        logger.error("MQTT connection failed (rc=%d)", rc)


def on_message(client, userdata, msg):
    try:
        handle_message(msg.topic, msg.payload.decode("utf-8"))
    except Exception as e:
        logger.error("Error handling %s: %s", msg.topic, e)


def on_disconnect(client, userdata, rc, properties=None):
    if rc != 0:
        logger.warning("MQTT disconnected (rc=%d), will reconnect", rc)


# ── Message dispatcher ──────────────────────────────────────────────────────

def handle_message(topic: str, payload: str):
    global db

    # Extract device ID and zone ID from topic
    device_id = None
    zone_id = None
    kind = None

    for pattern, k in TOPIC_PATTERNS:
        m = pattern.match(topic)
        if m:
            kind = k
            device_id = m.group(1)
            if m.lastindex and m.lastindex >= 2:
                zone_id = int(m.group(2))
            break

    if not device_id or not kind:
        logger.debug("Ignored topic: %s", topic)
        return

    if FILTER_IDS is not None and device_id not in FILTER_IDS:
        return

    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        logger.warning("Invalid JSON on %s: %s", topic, payload[:200])
        return

    if kind == "env":
        if isinstance(data.get("temp"), (int, float)):
            db.save_reading(device_id, None, "temp", float(data["temp"]), "°C")
        if isinstance(data.get("hum"), (int, float)):
            db.save_reading(device_id, None, "hum", float(data["hum"]), "%")

    elif kind == "soil":
        if isinstance(data.get("moisture"), (int, float)):
            db.save_reading(device_id, zone_id, "moisture", float(data["moisture"]), "")

    elif kind == "water":
        state = data.get("state", "")
        db.save_reading(device_id, zone_id, "water", 1.0 if state == "on" else 0.0, "")

    elif kind == "status":
        db.upsert_device(device_id)
        if isinstance(data.get("rssi"), (int, float)):
            db.save_reading(device_id, None, "rssi", float(data["rssi"]), "dBm")
        if isinstance(data.get("uptime"), (int, float)):
            db.save_reading(device_id, None, "uptime", float(data["uptime"]), "s")
        if isinstance(data.get("free_heap"), (int, float)):
            db.save_reading(device_id, None, "free_heap", float(data["free_heap"]), "bytes")
        if isinstance(data.get("sensors_ok"), (int, float)):
            db.save_reading(device_id, None, "sensors_ok", float(data["sensors_ok"]), "")
        if isinstance(data.get("sensors_total"), (int, float)):
            db.save_reading(device_id, None, "sensors_total", float(data["sensors_total"]), "")

    elif kind == "announce":
        name = data.get("device", device_id)
        db.upsert_device(device_id, str(name))


# ── Signal handling ─────────────────────────────────────────────────────────

def handle_signal(signum, frame):
    global running
    logger.info("Received signal %d, shutting down...", signum)
    running = False


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    global db, FILTER_IDS

    # Load .env from listener dir or project root
    env_paths = [
        Path(__file__).parent / ".env",
        Path(__file__).parent.parent / ".env",
    ]
    for p in env_paths:
        if p.exists():
            logger.info("Loading env from %s", p)
            import dotenv
            dotenv.load_dotenv(p)
            break

    # Database
    db_url = env_str("DATABASE_URL", "file:../monitor/data/gardener.db")
    db_token = env_str("TURSO_AUTH_TOKEN", "")
    db = Database(db_url, db_token or None)
    db.init()
    logger.info("Database ready")

    # Device filter
    raw = env_str("LISTENER_DEVICE_IDS", "")
    if raw.strip():
        FILTER_IDS = set(raw.strip().split(","))
        logger.info("Filtering devices: %s", FILTER_IDS)

    # MQTT
    mqtt_host = env_str("MQTT_HOST")
    mqtt_port = env_int("MQTT_PORT", 8883)
    mqtt_user = env_str("MQTT_USERNAME")
    mqtt_pass = env_str("MQTT_PASSWORD")
    mqtt_id = env_str("LISTENER_CLIENT_ID", f"gardener-listener-{int(time.time())}")

    if not mqtt_host:
        logger.error("MQTT_HOST is required")
        sys.exit(1)

    client = mqtt.Client(
        client_id=mqtt_id,
        protocol=mqtt.MQTTv5,
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    )

    client.tls_set()  # System CA certs (HiveMQ Cloud requires TLS)
    client.username_pw_set(mqtt_user, mqtt_pass)

    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    client.connect_async(mqtt_host, mqtt_port)
    client.loop_start()

    logger.info("Connecting to %s:%d...", mqtt_host, mqtt_port)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    try:
        while running:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        logger.info("Disconnecting...")
        client.loop_stop()
        client.disconnect()
        if db:
            db.close()
        logger.info("Shutdown complete")


if __name__ == "__main__":
    main()
