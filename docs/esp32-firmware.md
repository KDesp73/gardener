# ESP32 Firmware

## Mechanisms

### Sensor System (`sensor.h`, `sensor.cpp`)

Abstract sensor manager with pluggable drivers. Each sensor has an `init` and `read` function pointer:

```c
typedef struct {
    char           name[16];   // unique name, e.g. "soil_0", "dht22_temp"
    SensorInitFn   init;       // optional, called once at registration
    SensorReadFn   read;       // called every cycle, returns {value, valid}
    void*          config;     // driver-specific config (pin, handle, etc.)
    SensorReading  last;       // cached result from last read cycle
} Sensor;
```

Built-in drivers:

| Driver | Config | Payload | Notes |
|---|---|---|---|
| `dht22_read_temp` | `Dht22Config.pin` | Temperature °C | DHT22 on heap via `new DHT()` |
| `dht22_read_hum` | `Dht22Config` (shared) | Humidity % | Shares same DHT instance |
| `soil_moisture_read` | `SoilConfig.pin` | Raw ADC 0–4095 | `analogRead()`, always valid |

Sensor registration happens in `register_sensors()`:
1. Clears all sensors
2. Adds DHT22 if pin > 0
3. Iterates zones, adds `soil_{zone_id}` for each enabled zone
4. Inits relay pins as `OUTPUT LOW`

### Zone Management (`zone.h`, `zone.cpp`)

Up to 8 zones per ESP32 (`ZONES_MAX`). Each zone has:

```c
typedef struct {
    uint8_t  id;              // zone index (0-based)
    char     name[16];        // plant name
    uint8_t  soil_pin;        // ADC input for moisture sensor
    uint8_t  relay_pin;       // GPIO driving the pump relay
    uint16_t dry_threshold;   // below this = needs water
    uint16_t wet_threshold;   // above this = wet enough
    uint16_t max_run_sec;     // safety cutoff (seconds)
    uint16_t schedule_on;     // minutes from midnight
    uint16_t schedule_off;    // minutes from midnight
    bool     enabled;
    uint8_t  sensor_type;     // 0=capacitive, 1=resistive
} ZoneConfig;
```

Persistence via NVS (Preferences library): `zone_manager_save()` serializes the entire `ZoneManager` struct to NVS. On boot, `zone_manager_init()` loads it back. Struct size mismatch = fresh start.

### MQTT Communication (`mqtt.h`, `mqtt.cpp`)

PubSubClient with exponential backoff reconnection (1s → 30s). Topics:

| Topic | Direction | Payload |
|---|---|---|
| `gardener/{id}/status` | publish | `{"rssi":-45,"uptime":3600,"free_heap":120000,"sensors_ok":3,"sensors_total":4}` |
| `gardener/{id}/env` | publish | `{"temp":23.5,"hum":60.1}` |
| `gardener/{id}/announce` | publish (retained) | `{"device":"balcony","version":"1.0"}` |
| `gardener/{id}/zone/{z}/soil` | publish | `{"moisture":2048}` |
| `gardener/{id}/zone/{z}/water` | publish (retained) | `{"state":"on"}` or `{"state":"off"}` |
| `gardener/{id}/zone/{z}/config` | subscribe | Zone configuration (thresholds, pins, etc.) |
| `gardener/{id}/zone/+/cmd/water` | subscribe | `{"state":"on","duration":60}` |

On connect, the device publishes a retained announce message and subscribes to:
- `gardener/{id}/zone/+/config` — wildcard for all zone config updates
- `gardener/{id}/zone/+/cmd/water` — wildcard for water commands

### Auto-Watering (`main.cpp` — `manage_watering()`)

Runs every 5s after sensor read. Per zone:

```
for each enabled zone with relay_pin > 0:
    moisture = get_soil_moisture(zone.id)

    if currently watering:
        elapsed = now - water_start[zone.id]
        if elapsed >= max_run_sec OR moisture >= wet_threshold:
            → stop watering (relay LOW, publish water state)

    else if zone_needs_water(zone, moisture):
        → start watering (relay HIGH, publish water state)
```

**Threshold check** accounts for sensor type:

```c
// Capacitive: low value = dry
// Resistive: high value = dry
needs_water = sensor_type == resistive
    ? moisture >= dry_threshold
    : moisture <= dry_threshold

is_wet = sensor_type == resistive
    ? moisture <= wet_threshold
    : moisture >= wet_threshold
```

**Manual override**: MQTT `cmd/water` with `{"state":"on","duration":60}` starts watering immediately. The duration replaces `max_run_sec` for that cycle. Sending `{"state":"off"}` stops early.

### Device Health

Published every 5s in status message:

| Field | Source |
|---|---|
| `rssi` | `WiFi.RSSI()` |
| `uptime` | `millis() / 1000` |
| `free_heap` | `ESP.getFreeHeap()` |
| `sensors_ok` | Count of sensors with valid readings |
| `sensors_total` | `sensor_manager_count()` |

## Config via `.env`

The `extra_script.py` generates `include/env_config.h` at build time from `.env`:

```ini
WIFI_SSID=MyNetwork
WIFI_PASSWORD=secret
MQTT_HOST=cluster.s1.eu.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=user
MQTT_PASSWORD=pass
MQTT_DEVICE_ID=balcony
DHT22_PIN=4
```
