# Configuration Reference

## ESP32 — Root `.env`

Loaded at build time by `scripts/extra_script.py` → generates `include/env_config.h`.

| Variable | Required | Default | Description |
|---|---|---|---|
| `WIFI_SSID` | yes | — | WiFi network name |
| `WIFI_PASSWORD` | yes | — | WiFi password |
| `WIFI_MAC` | no | empty | Optional BSSID to pin a specific access point |
| `MQTT_HOST` | yes | — | MQTT broker hostname |
| `MQTT_PORT` | no | 1883 | MQTT broker port (8883 for TLS) |
| `MQTT_USER` | no | empty | MQTT username |
| `MQTT_PASS` | no | empty | MQTT password |
| `MQTT_DEVICE_ID` | no | MAC-based | Unique device identifier |
| `DHT22_PIN` | no | 0 | GPIO pin for DHT22 (0 = disabled) |

## Monitor — `monitor/.env.local`

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | no | `file:./data/gardener.db` | Database URL (file: for SQLite, libsql:// for Turso) |
| `TURSO_AUTH_TOKEN` | no | — | Turso auth token (required for remote) |
| `MQTT_HOST` | yes | — | MQTT broker for server-side config publishing |
| `MQTT_PORT` | no | 1883 | MQTT broker port |
| `MQTT_USERNAME` | no | empty | MQTT username |
| `MQTT_PASSWORD` | no | empty | MQTT password |
| `NEXT_PUBLIC_MQTT_WS_URL` | yes | — | WebSocket URL for browser (`wss://host:8884/mqtt`) |
| `NEXT_PUBLIC_MQTT_USERNAME` | no | empty | WebSocket MQTT username |
| `NEXT_PUBLIC_MQTT_PASSWORD` | no | empty | WebSocket MQTT password |

## Listener — `listener/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `MQTT_HOST` | yes | — | MQTT broker hostname |
| `MQTT_PORT` | no | 8883 | MQTT broker port (TLS) |
| `MQTT_USERNAME` | no | empty | MQTT username |
| `MQTT_PASSWORD` | no | empty | MQTT password |
| `LISTENER_CLIENT_ID` | no | gardener-listener-{ts} | MQTT client ID |
| `DATABASE_URL` | no | `file:../monitor/data/gardener.db` | Database URL |
| `TURSO_AUTH_TOKEN` | no | — | Turso auth token |
| `LISTENER_DEVICE_IDS` | no | all | Comma-separated device whitelist |

## HiveMQ Cloud Ports

| Port | Protocol | Used By |
|---|---|---|
| 8883 | MQTT over TLS | ESP32, Listener, Monitor (server-side) |
| 8884 | MQTT over WebSocket + TLS | Monitor (browser) |
