# Database Schema

Shared between the Monitor (Next.js via `@libsql/client`) and the Listener (Python via `sqlite3`/HTTP). Supports both local SQLite and Turso remote databases.

## Tables

### `devices`

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | Device identifier (e.g. "balcony") |
| `name` | TEXT | Human-readable name |
| `mqtt_host` | TEXT | Broker host (informational) |
| `last_seen` | TEXT | Last announce/status timestamp |
| `created_at` | TEXT | Row creation timestamp |

Upsert on every announce and status message.

### `zones`

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK AUTO | Internal row ID |
| `device_id` | TEXT FK → devices | Owning device |
| `zone_id` | INTEGER | Zone index (0-based) |
| `name` | TEXT | Plant name |
| `soil_pin` | INTEGER | ADC GPIO for soil sensor |
| `relay_pin` | INTEGER | GPIO for pump relay |
| `dry_threshold` | INTEGER | ADC value below which = dry |
| `wet_threshold` | INTEGER | ADC value above which = wet |
| `max_run_sec` | INTEGER | Max watering duration (safety) |
| `schedule_on` | INTEGER | Minutes from midnight, start |
| `schedule_off` | INTEGER | Minutes from midnight, end |
| `sensor_type` | TEXT | "capacitive" or "resistive" |
| `enabled` | INTEGER | 0/1 |
| `created_at` | TEXT | Creation timestamp |
| `updated_at` | TEXT | Last update timestamp |

`UNIQUE(device_id, zone_id)` — one config per zone per device.

### `latest_readings`

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK AUTO | Internal row ID |
| `device_id` | TEXT | Device identifier |
| `zone_id` | INTEGER? | NULL for device-level sensors (temp, hum, rssi) |
| `sensor_type` | TEXT | e.g. "temp", "hum", "moisture", "rssi", "uptime" |
| `value` | REAL | Most recent reading |
| `unit` | TEXT | Unit string ("°C", "%", "dBm", "s", etc.) |
| `updated_at` | TEXT | Timestamp of last update |

One row per `(device_id, zone_id, sensor_type)` — upserted on each new reading.

### `readings`

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK AUTO | Internal row ID |
| `device_id` | TEXT | Device identifier |
| `zone_id` | INTEGER? | NULL for device-level sensors |
| `sensor_type` | TEXT | e.g. "temp", "moisture" |
| `value` | REAL | Reading value |
| `unit` | TEXT | Unit string |
| `created_at` | TEXT | Timestamp |

Append-only history table. One row per reading event. Used for history charts.

## Sensor Types in `readings` / `latest_readings`

| `sensor_type` | Where | `zone_id` | Unit |
|---|---|---|---|
| `temp` | `/env` | NULL | °C |
| `hum` | `/env` | NULL | % |
| `moisture` | `/zone/{z}/soil` | zone | (raw ADC) |
| `water` | `/zone/{z}/water` | zone | (1 or 0) |
| `rssi` | `/status` | NULL | dBm |
| `uptime` | `/status` | NULL | s |
| `free_heap` | `/status` | NULL | bytes |
| `sensors_ok` | `/status` | NULL | count |
| `sensors_total` | `/status` | NULL | count |

## Migration

The schema is auto-created via `CREATE TABLE IF NOT EXISTS` in both the monitor's `lib/db.ts` and the listener's `db.py`. Column additions (e.g. `sensor_type` on `zones`) are handled via `ALTER TABLE` in a try/catch block.

For local SQLite, WAL mode is enabled for better concurrent access.
