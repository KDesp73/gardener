# Gardener — Automated Watering System & Monitoring Platform

Extensible ESP32-based automated watering system. A single ESP32 can serve multiple plants (zones), and multiple ESP32s can coexist in the same MQTT-based system. Written in C-style C++ on the Arduino framework.

## System Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│  ESP32 "balcony"    │     │  ESP32 "greenhouse"  │
│                     │     │                      │
│ Zone 0: basil       │     │ Zone 0: tomatoes     │
│ Zone 1: mint        │     │ Zone 1: peppers      │
│ Zone 2: rosemary    │     │ Zone 2: cucumbers    │
└────────┬────────────┘     └───────────┬──────────┘
         │                              │
         └──────────┬───────────────────┘
                    │ MQTT
              ┌─────▼──────┐
              │   Broker    │── HomeAssistant / Node-RED / etc.
              └────────────┘
```

## Hardware (per ESP32)

| Component | Qty | Purpose |
|---|---|---|
| ESP32 DevKit | 1 | MCU, WiFi, ADC |
| Capacitative soil moisture sensor | 1 per zone | Measures soil water content (analog) |
| DHT22 | 1 | Ambient temperature & humidity (shared per device) |
| Relay module (multi-channel) | 1 per zone | Switches pump on/off per zone |
| Water pump (submersible) | 1 per zone | Delivers water to each plant |
| Power supply | 1 | Powers ESP32, pumps, and sensors |

### Pin Mapping (TBD)

| Signal | GPIO |
|---|---|
| Soil moisture zone 0 | TBD |
| Soil moisture zone 1 | TBD |
| Soil moisture zone N | TBD |
| DHT22 data | TBD |
| Relay zone 0 | TBD |
| Relay zone 1 | TBD |
| Relay zone N | TBD |

## Extensibility Design

### Multi-Plant (per ESP32)

Each "zone" represents one plant with its own:
- Soil moisture sensor (dedicated ADC input)
- Relay + pump (independent watering)
- Moisture thresholds (dry/wet)
- Watering schedule (time window)
- Max runtime (safety cutoff)

Zones are tracked as an array in code — adding a new plant means wiring a sensor + relay and bumping the zone count in config.

### Multi-Device (per System)

Each ESP32 has a unique **device ID** (configurable, default derived from MAC). Devices operate independently and are distinguished in the MQTT topic tree. No master/slave — every device is self-contained.

## Communication — MQTT

### Topic Structure

`gardener/{device_id}/zone/{zone_id}/{subject}`

| Topic | Direction | Payload |
|---|---|---|
| `gardener/{id}/status` | publish | `{ "rssi": -45, "uptime": 3600 }` |
| `gardener/{id}/env` | publish | `{ "temp": 23.5, "humidity": 60.1 }` |
| `gardener/{id}/zone/{z}/soil` | publish | `{ "moisture": 2048 }` |
| `gardener/{id}/zone/{z}/water` | publish | `{ "state": "on"\|"off", "reason": "...", "duration": 30 }` |
| `gardener/{id}/zone/{z}/cmd/water` | subscribe | `on` / `off` — manual override |
| `gardener/{id}/zone/{z}/config` | publish + subscribe | Per-zone config (thresholds, schedule) |
| `gardener/{id}/config` | publish + subscribe | Device-wide config (WiFi, MQTT) |

### Discovery

On boot, each device publishes its zone layout:

`gardener/{id}/announce` → `{ "device": "balcony", "zones": 3, "version": "1.0" }`

## Watering Logic (per Zone)

Two conditions must be met:
1. **Schedule** — current time falls within a configurable daily window
2. **Threshold** — raw moisture reading is below the configured dry threshold

Watering stops when:
- Moisture rises above the wet threshold, OR
- Max runtime is exceeded (safety cutoff)

State changes are published over MQTT. Manual override via `cmd/water` bypasses logic until an explicit `off` or timeout.

## Libraries

| Library | Purpose |
|---|---|
| `Arduino.h` (framework) | Core ESP32 Arduino API |
| `DHT sensor library` (Adafruit) | DHT22 driver |
| `PubSubClient` | MQTT client over WiFi |
| `WiFi.h` (built-in) | WiFi connectivity |
| `ArduinoJson` | JSON serialization for MQTT payloads |
| `Preferences.h` (built-in) | Persistent config storage (NVS) |

### platformio.ini

```ini
lib_deps =
    adafruit/DHT sensor library
    knolleary/PubSubClient
    bblanchon/ArduinoJson
```

## Build & Deploy

```sh
make build    # compile
make upload   # flash to ESP32
make monitor  # serial monitor
```

## Configuration

### Device Config (NVS)

| Key | Description |
|---|---|
| `device_id` | Unique device name (default: MAC) |
| `wifi_ssid` / `wifi_pass` | WiFi credentials |
| `mqtt_host` / `mqtt_port` | MQTT broker address |

### Per-Zone Config (NVS, keyed by zone index)

| Key | Description |
|---|---|
| `zone_{i}_dry` | Dry threshold (ADC raw 0–4095) |
| `zone_{i}_wet` | Wet threshold (ADC raw 0–4095) |
| `zone_{i}_schedule_on` | Watering window start (seconds from midnight) |
| `zone_{i}_schedule_off` | Watering window end |
| `zone_{i}_max_run` | Max pump runtime in seconds |
| `zone_{i}_interval` | Min seconds between watering cycles |

All config is readable and writable over MQTT for remote management.
