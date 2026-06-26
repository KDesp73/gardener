import { createClient, Client } from "@libsql/client";

let db: Client | null = null;

export function getDb(): Client {
  if (db) return db;

  db = createClient({
    url: process.env.DATABASE_URL || "file:./data/gardener.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  initSchema();
  return db;
}

async function initSchema() {
  await db!.execute(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      mqtt_host TEXT DEFAULT '',
      last_seen TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db!.execute(`
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
  `);

  await db!.execute(`
    CREATE TABLE IF NOT EXISTS latest_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      zone_id INTEGER,
      sensor_type TEXT NOT NULL,
      value REAL,
      unit TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(device_id, COALESCE(zone_id, -1), sensor_type)
    )
  `);

  await db!.execute(`
    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      zone_id INTEGER,
      sensor_type TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // migration: add sensor_type column to zones if missing
  try {
    await db!.execute(
      "ALTER TABLE zones ADD COLUMN sensor_type TEXT NOT NULL DEFAULT 'capacitive'",
    );
  } catch {
    // column already exists
  }

  // migration: add image column to zones if missing
  try {
    await db!.execute(
      "ALTER TABLE zones ADD COLUMN image TEXT DEFAULT NULL",
    );
  } catch {
    // column already exists
  }
}
