# System Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│  ESP32 "balcony"    │     │  ESP32 "greenhouse"  │
│  ───────────────    │     │  ────────────────    │
│  Zone 0: basil      │     │  Zone 0: tomatoes    │
│  Zone 1: mint       │     │  Zone 1: peppers     │
│  Zone 2: rosemary   │     │  Zone 2: cucumbers   │
│  DHT22 (env temp/hum)│    │  DHT22 (env temp/hum)│
└──────┬──────────────┘     └──────────┬───────────┘
       │                               │
       │  MQTT (TLS, port 8883)        │
       └──────────┬────────────────────┘
                  │
          ┌───────▼────────┐
          │  HiveMQ Cloud  │
          │   (Broker)     │
          └───────┬────────┘
                  │
     ┌────────────┼────────────────┐
     │            │                │
┌────▼─────┐ ┌───▼────┐ ┌────────▼──────┐
│ Monitor  │ │Listener│ │ Node-RED /    │
│ (Next.js)│ │(Python)│ │ HomeAssistant │
│ Web UI   │ │daemon  │ │ (optional)    │
└────┬─────┘ └───┬────┘ └───────────────┘
     │           │
     └──────┬────┘
            │
     ┌──────▼──────┐
     │   Database  │
     │ SQLite/Turso│
     └─────────────┘
```

## Components

| Component | Language | Purpose |
|---|---|---|
| **ESP32 Firmware** | C (Arduino) | Reads sensors, controls pumps, publishes to MQTT |
| **Monitor** | TypeScript (Next.js) | Web dashboard for real-time data + management |
| **Listener** | Python | Always-on daemon that archives all MQTT data to DB |
| **Database** | SQLite / Turso | Persistent storage for readings, config, devices |

## Data Flow

1. ESP32 reads sensors every 5s, publishes to MQTT
2. ESP32 auto-watering loop checks thresholds, drives relays, publishes state changes
3. Listener receives all MQTT messages → writes to DB (readings + latest_readings)
4. Monitor browser receives MQTT via WebSocket for real-time display
5. Monitor server actions publish config changes back to ESP32 via MQTT
6. Monitor server actions read/write DB for zone CRUD and history
