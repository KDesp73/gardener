# Listener Service

Always-on Python daemon that subscribes to all MQTT topics and archives every message to the database. Unlike the monitor dashboard (which only stores data while the browser tab is open), the listener runs continuously.

```
listener/
├── __init__.py
├── __main__.py     # entry point: python -m listener
├── main.py         # MQTT subscriber + message dispatch
├── db.py           # dual-backend database abstraction
├── .env.example
└── requirements.txt
```

## How It Works

1. Connects to MQTT broker via TLS on port 8883
2. Subscribes to `gardener/+/#` across all devices
3. For each message, extracts device ID and zone ID from the topic
4. Parses JSON payload
5. Writes to database (upserts `latest_readings`, appends to `readings`, upserts `devices`)

## Topics Handled

| Topic pattern | Fields saved |
|---|---|
| `gardener/{id}/env` | `temp` (°C), `hum` (%) |
| `gardener/{id}/zone/{z}/soil` | `moisture` (raw ADC) |
| `gardener/{id}/status` | `rssi`, `uptime`, `free_heap`, `sensors_ok`, `sensors_total` |
| `gardener/{id}/announce` | Device upsert from `device` field |
| `gardener/{id}/zone/{z}/water` | `water` state (1.0 / 0.0) |

## Database Backends

### SQLite (local)

Set `DATABASE_URL=file:../monitor/data/gardener.db` to share the same database file as the monitor dev instance. Uses Python's built-in `sqlite3` module with WAL mode.

### Turso (remote)

Set `DATABASE_URL=libsql://db-org.turso.io` and `TURSO_AUTH_TOKEN=...`. The `libsql://` URL is automatically converted to `https://` for the HTTP API (`v2/pipeline` endpoint). Args are typed correctly (integer/real/text/null).

## Running

```sh
pip install -r listener/requirements.txt

# Configure
cp listener/.env.example listener/.env
# Edit listener/.env with MQTT credentials and database URL

# Start
python -m listener
```

Env files are loaded in order: `listener/.env` → root `.env`. Set `LISTENER_DEVICE_IDS` to a comma-separated whitelist, or leave empty to listen to all devices.

## Production Deployment

Run as a systemd service or in a screen/tmux session:

```sh
# systemd unit example
[Unit]
Description=Gardener MQTT Listener

[Service]
WorkingDirectory=/home/gardener/gardener
ExecStart=/usr/bin/python3 -m listener
Restart=always
User=gardener

[Install]
WantedBy=multi-user.target
```
