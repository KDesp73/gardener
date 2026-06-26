# Monitor Dashboard

Next.js 16 app in `monitor/` with shadcn UI, real-time MQTT via WebSocket, and Turso/SQLite persistence.

## Pages

| Route | Description |
|---|---|
| `/dashboard` | Main dashboard (redirect from `/`) |
| `/api/mqtt-webhook` | HTTP endpoint for posting readings (alternative to MQTT) |

## Real-Time Data

### Browser MQTT Client (`lib/mqtt-browser.ts`)

Connects to the MQTT broker via WebSocket (port 8884) and subscribes to all device topics. Parses incoming JSON and emits typed events:

| MQTT Topic | Emits | Stored As |
|---|---|---|
| `gardener/+/env` | `temp`, `hum` | `{deviceId}:env:{sensorType}` |
| `gardener/+/zone/+/soil` | `moisture` | `{deviceId}:{zoneId}:moisture` |
| `gardener/+/status` | `rssi`, `uptime`, `freeHeap`, `sensorsOk/Total` | `{deviceId}:env:{sensorType}` |
| `gardener/+/announce` | `deviceId`, `version` | Triggers device upsert |
| `gardener/+/zone/+/water` | `water` (1 or 0) | `{deviceId}:{zoneId}:water` |

Each reading is stored as `{value: number, ts: number}` to enable stale detection.

### Stale Data Detection

The dashboard tracks `Date.now()` when each MQTT message arrives. A reading is considered **stale** if the timestamp is older than 30 seconds. Zone cards show:
- "old data" badge
- Dimmed opacity on the device panel
- Status reverts to "unknown" until fresh data arrives

### Device Health Panel

Shows per-device:
- **Online/Offline** badge (30s timeout)
- **Signal bars** (4 levels based on RSSI: ≥-50, ≥-65, ≥-80, ≥-80)
- **Uptime** (formatted as d/h/m)
- **Free heap** in KB
- **Sensor health** — "X/Y" count with "X failed" badge if sensors are missing

## Zone Management

### Zone Card

Each zone displays:
- **Status badge**: "Needs water" (red), "OK" (amber), "Wet" (blue), or "—"
- **Watering badge** when water state is "on"
- **Stale badge** if no reading for 30s
- **Moisture bar**: visual indicator from dry threshold (red) through OK (amber) to wet (blue)
- **Quick stats**: temp, humidity, schedule window
- **Water Now** button: publishes `cmd/water` with `max_run_sec` duration
- **Enable/disable switch**: toggles zone via MQTT config `{"enabled": true/false}`
- **Show history**: fetches and renders an SVG line chart of recent readings
- **Show config**: expandable section with all zone parameters
- **Edit button**: opens pre-filled form dialog
- **Delete button**: removes zone from DB + sends `{"enabled": false}` config

### Zone Form Dialog

Used for both **add** and **edit**. Shared server action `createZone()` does UPSERT (INSERT ... ON CONFLICT DO UPDATE). Fields:

| Field | Type | Default |
|---|---|---|
| Device | select | first device |
| Plant Name | text | — |
| Sensor Type | select | Capacitive |
| Soil Pin | number | 34 |
| Relay Pin | number | 12 |
| Dry Threshold | number | 1500 |
| Wet Threshold | number | 3000 |
| Max Run (s) | number | 60 |
| Schedule Start | number (min) | 420 (07:00) |
| Schedule End | number (min) | 480 (08:00) |

### Sensor Type Logic

```
Capacitive (low=dry, high=wet):
  dry  = moisture <= dry_threshold
  wet  = moisture >= wet_threshold

Resistive (high=dry, low=wet):
  dry  = moisture >= dry_threshold
  wet  = moisture <= wet_threshold
```

## History Chart

Inline SVG chart (`components/readings-chart.tsx`) that fetches the last 60 readings from the DB and renders a line. Toggle per zone card.

## Server Actions (`app/actions.ts`)

| Action | Purpose |
|---|---|
| `getDevices()` | List all devices |
| `getZones(deviceId)` | List zones for a device |
| `getLatestReadings(deviceId)` | Latest readings per sensor |
| `getReadings(deviceId, zoneId, sensorType, limit)` | Reading history for chart |
| `discoverDevice(deviceId, name)` | Upsert device from MQTT announce |
| `createZone(data)` | Create/update zone + publish config via MQTT |
| `deleteZone(deviceId, zoneId)` | Remove zone + publish disabled config |
| `toggleZone(deviceId, zoneId, enabled)` | Enable/disable + publish config |
| `waterZone(deviceId, zoneId, seconds)` | Publish water command via MQTT |
| `saveReading(...)` | Ingest reading via webhook |

## Configuration

In `monitor/.env.local`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `file:./data/gardener.db` or Turso URL |
| `TURSO_AUTH_TOKEN` | Turso auth token (remote only) |
| `MQTT_HOST/PORT` | MQTT broker for server-side publishing |
| `MQTT_USERNAME/PASSWORD` | MQTT credentials |
| `NEXT_PUBLIC_MQTT_WS_URL` | WebSocket URL for browser (wss://..., port 8884) |
| `NEXT_PUBLIC_MQTT_USERNAME/PASSWORD` | WS credentials |
