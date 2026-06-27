#include <Arduino.h>
#include <WiFi.h>
#include <string.h>
#include <stdlib.h>
#include <ArduinoJson.h>
#include "logger.h"
#include "env_config.h"
#include "wifi_utils.h"
#include "sensor.h"
#include "mqtt.h"
#include "zone.h"

#define TAG "main"

static SensorManager g_sensors;
static Dht22Config   g_dht_cfg;

// ── Water state ────────────────────────────────────────────────────────────

static bool          g_watering[ZONES_MAX];
static unsigned long g_water_start[ZONES_MAX];

#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif

static void update_builtin_led(void)
{
    bool any_on = false;
    for (int i = 0; i < ZONES_MAX; i++) {
        if (g_watering[i]) { any_on = true; break; }
    }
    digitalWrite(LED_BUILTIN, any_on ? HIGH : LOW);
}

static const ZoneConfig* get_zone_by_id(uint8_t id)
{
    for (int i = 0; i < zone_manager_count(); i++) {
        if (g_zone_mgr.zones[i].id == id) return &g_zone_mgr.zones[i];
    }
    return NULL;
}

static bool zone_needs_water(const ZoneConfig* z, float moisture)
{
    if (!z->enabled || z->relay_pin == 0) return false;
    if (moisture <= 0) return false;
    return z->sensor_type == 1
        ? moisture >= (float)z->dry_threshold
        : moisture <= (float)z->dry_threshold;
}

static bool zone_is_wet_enough(const ZoneConfig* z, float moisture)
{
    return z->sensor_type == 1
        ? moisture <= (float)z->wet_threshold
        : moisture >= (float)z->wet_threshold;
}

// ── Sensor helpers ─────────────────────────────────────────────────────────

static float get_soil_moisture(uint8_t zone_id)
{
    char name[SENSOR_NAME_MAX];
    snprintf(name, sizeof(name), "soil_%d", zone_id);
    SensorReading r = sensor_manager_get(&g_sensors, name);
    return r.valid ? r.value : -1.0f;
}

static int count_valid_sensors(void)
{
    int ok = 0;
    for (int i = 0; i < sensor_manager_count(&g_sensors); i++) {
        if (g_sensors.sensors[i].last.valid) ok++;
    }
    return ok;
}

// ── Registration ───────────────────────────────────────────────────────────

static void register_sensors(void)
{
    sensor_manager_clear(&g_sensors);

    int dht_pin = atoi(DHT22_PIN);
    if (dht_pin > 0) {
        g_dht_cfg = (Dht22Config){.pin = (uint8_t)dht_pin, .handle = NULL};
        sensor_manager_add(&g_sensors, "dht22_temp", dht22_init, dht22_read_temp, &g_dht_cfg);
        sensor_manager_add(&g_sensors, "dht22_hum",  NULL,       dht22_read_hum,  &g_dht_cfg);
    }

    for (int i = 0; i < zone_manager_count(); i++) {
        const ZoneConfig* z = &g_zone_mgr.zones[i];
        if (!z->enabled) continue;

        char name[SENSOR_NAME_MAX];
        snprintf(name, sizeof(name), "soil_%d", z->id);

        static SoilConfig soil_cfgs[ZONES_MAX];
        soil_cfgs[z->id] = (SoilConfig){.pin = z->soil_pin};
        sensor_manager_add(&g_sensors, name, NULL, soil_moisture_read, &soil_cfgs[z->id]);

        // Init relay pin as output
        if (z->relay_pin > 0) {
            pinMode(z->relay_pin, OUTPUT);
            digitalWrite(z->relay_pin, LOW);
        }
    }

    sensor_manager_init_all(&g_sensors);
    LOG_INFO(&g_logger, TAG, "Registered %d sensor(s)", sensor_manager_count(&g_sensors));
}

// ── Publishing ─────────────────────────────────────────────────────────────

static void publish_sensors(void)
{
    JsonDocument doc;
    char         payload[192];
    char         topic[MQTT_TOPIC_MAX];

    float temp = NAN, hum = NAN;
    for (int i = 0; i < sensor_manager_count(&g_sensors); i++) {
        SensorReading r = sensor_manager_get_by_index(&g_sensors, i);
        const char*   n = g_sensors.sensors[i].name;

        if (strcmp(n, "dht22_temp") == 0 && r.valid) temp = r.value;
        if (strcmp(n, "dht22_hum")  == 0 && r.valid) hum  = r.value;

        if (strncmp(n, "soil_", 5) == 0 && r.valid) {
            int zone = atoi(n + 5);
            doc.clear();
            doc["moisture"] = (int)r.value;
            serializeJson(doc, payload, sizeof(payload));
            mqtt_topic_soil(topic, sizeof(topic), zone);
            mqtt_publish(topic, payload, false);
        }
    }

    if (!isnan(temp) || !isnan(hum)) {
        doc.clear();
        if (!isnan(temp)) doc["temp"] = temp;
        if (!isnan(hum))  doc["hum"]  = hum;
        serializeJson(doc, payload, sizeof(payload));
        mqtt_topic_env(topic, sizeof(topic));
        mqtt_publish(topic, payload, false);
    }
}

static void publish_status(void)
{
    char topic[MQTT_TOPIC_MAX];
    char payload[128];

    int total = sensor_manager_count(&g_sensors);
    int ok    = count_valid_sensors();

    mqtt_topic_status(topic, sizeof(topic));
    snprintf(payload, sizeof(payload),
             "{\"rssi\":%ld,\"uptime\":%lu,\"free_heap\":%u,\"sensors_ok\":%d,\"sensors_total\":%d}",
             WiFi.RSSI(), millis() / 1000, ESP.getFreeHeap(), ok, total);
    mqtt_publish(topic, payload, false);
}

static void publish_water_state(uint8_t zone_id, bool on)
{
    char topic[MQTT_TOPIC_MAX];
    char payload[48];
    mqtt_topic_water(topic, sizeof(topic), zone_id);
    snprintf(payload, sizeof(payload), "{\"state\":\"%s\"}", on ? "on" : "off");
    mqtt_publish(topic, payload, true);
}

// ── Auto-watering logic ────────────────────────────────────────────────────

static void manage_watering(unsigned long now_ms)
{
    for (int i = 0; i < zone_manager_count(); i++) {
        const ZoneConfig* z = &g_zone_mgr.zones[i];
        if (!z->enabled || z->relay_pin == 0) {
            if (g_watering[z->id]) {
                g_watering[z->id] = false;
                if (z->relay_pin > 0) digitalWrite(z->relay_pin, LOW);
                update_builtin_led();
            }
            continue;
        }

        float moisture = get_soil_moisture(z->id);
        if (moisture < 0) continue;

        if (g_watering[z->id]) {
            unsigned long elapsed = (now_ms - g_water_start[z->id]) / 1000;
            if (elapsed >= z->max_run_sec || zone_is_wet_enough(z, moisture)) {
                g_watering[z->id] = false;
                digitalWrite(z->relay_pin, LOW);
                update_builtin_led();
                publish_water_state(z->id, false);
                LOG_INFO(&g_logger, TAG, "Zone %d watering stopped (elapsed=%lu, moisture=%.0f)",
                         z->id, elapsed, moisture);
            }
        } else if (zone_needs_water(z, moisture)) {
            g_watering[z->id] = true;
            g_water_start[z->id] = now_ms;
            digitalWrite(z->relay_pin, HIGH);
            update_builtin_led();
            publish_water_state(z->id, true);
            LOG_INFO(&g_logger, TAG, "Zone %d watering started (moisture=%.0f, dry=%d)",
                     z->id, moisture, z->dry_threshold);
        }
    }
}

// ── MQTT callbacks ─────────────────────────────────────────────────────────

static void start_manual_water(uint8_t zone_id, uint16_t duration_sec)
{
    const ZoneConfig* z = get_zone_by_id(zone_id);
    if (!z || z->relay_pin == 0) return;

    g_watering[zone_id] = true;
    g_water_start[zone_id] = millis();
    // Override max_run with requested duration
    digitalWrite(z->relay_pin, HIGH);
    update_builtin_led();
    publish_water_state(zone_id, true);
    LOG_INFO(&g_logger, TAG, "Manual water zone %d for %ds", zone_id, duration_sec);
}

static void stop_manual_water(uint8_t zone_id)
{
    const ZoneConfig* z = get_zone_by_id(zone_id);
    if (!z || z->relay_pin == 0) return;

    g_watering[zone_id] = false;
    digitalWrite(z->relay_pin, LOW);
    update_builtin_led();
    publish_water_state(zone_id, false);
    LOG_INFO(&g_logger, TAG, "Manual water zone %d stopped", zone_id);
}

static void on_mqtt_message(const char* topic, const char* payload, uint16_t len)
{
    int zone_id;

    // Zone config update
    if (sscanf(topic, "gardener/%*[^/]/zone/%d/config", &zone_id) == 1) {
        int changed = zone_manager_apply_json((uint8_t)zone_id, payload, len);
        if (changed > 0) {
            register_sensors();
        }
        return;
    }

    // Water command
    if (sscanf(topic, "gardener/%*[^/]/zone/%d/cmd/water", &zone_id) == 1) {
        JsonDocument doc;
        DeserializationError err = deserializeJson(doc, payload, len);
        if (err) {
            LOG_WARN(&g_logger, TAG, "Water cmd parse error: %s", err.c_str());
            return;
        }

        const char* state = doc["state"] | "";
        if (strcmp(state, "on") == 0) {
            uint16_t duration = doc["duration"] | 60;
            start_manual_water((uint8_t)zone_id, duration);
        } else if (strcmp(state, "off") == 0) {
            stop_manual_water((uint8_t)zone_id);
        }
        return;
    }
}

// ── Setup / Loop ───────────────────────────────────────────────────────────

void setup()
{
    Serial.begin(115200);
    logger_init_global();

    memset(g_watering, 0, sizeof(g_watering));
    memset(g_water_start, 0, sizeof(g_water_start));

    pinMode(LED_BUILTIN, OUTPUT);
    digitalWrite(LED_BUILTIN, LOW);   // off (active HIGH)

    sensor_manager_init(&g_sensors);
    zone_manager_init();
    register_sensors();

    WifiConfig wifi;
    wifi_load_env(&wifi);
    wifi_connect(&wifi);

    MqttConfig mqtt;
    mqtt_load_env(&mqtt);
    mqtt_init(&mqtt);
    mqtt_set_callback(on_mqtt_message);
    mqtt_connect();

    char topic[MQTT_TOPIC_MAX];
    mqtt_topic_zone_config_wc(topic, sizeof(topic));
    mqtt_subscribe(topic);

    snprintf(topic, sizeof(topic), "gardener/%s/zone/+/cmd/water", MQTT_DEVICE_ID);
    mqtt_subscribe(topic);

    // Clear stale retained water states after reboot
    for (int i = 0; i < zone_manager_count(); i++) {
        const ZoneConfig* z = &g_zone_mgr.zones[i];
        if (z->relay_pin > 0) {
            digitalWrite(z->relay_pin, LOW);
        }
        publish_water_state(z->id, false);
    }
}

void loop()
{
    mqtt_loop();

    static unsigned long last_read = 0;
    unsigned long now = millis();
    if (now - last_read >= 5000) {
        last_read = now;

        sensor_manager_read_all(&g_sensors);

        for (int i = 0; i < sensor_manager_count(&g_sensors); i++) {
            SensorReading r = sensor_manager_get_by_index(&g_sensors, i);
            const char* name = g_sensors.sensors[i].name;
            if (r.valid) {
                LOG_INFO(&g_logger, name, "%.2f", r.value);
            } else {
                LOG_WARN(&g_logger, name, "invalid reading");
            }
        }

        manage_watering(now);

        if (mqtt_connected()) {
            publish_status();
            publish_sensors();
        }
    }
}
