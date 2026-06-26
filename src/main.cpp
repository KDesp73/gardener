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

static SensorManager g_sensors;
static Dht22Config   g_dht_cfg;
static SoilConfig    g_soil_cfgs[3];

static void register_sensors(void)
{
    int dht_pin = atoi(DHT22_PIN);
    if (dht_pin > 0) {
        g_dht_cfg = (Dht22Config){.pin = (uint8_t)dht_pin, .handle = NULL};
        sensor_manager_add(&g_sensors, "dht22_temp", dht22_init, dht22_read_temp, &g_dht_cfg);
        sensor_manager_add(&g_sensors, "dht22_hum",  NULL,       dht22_read_hum,  &g_dht_cfg);
    }

    const char* soil_pins[] = {SOIL_0_PIN, SOIL_1_PIN, SOIL_2_PIN};
    const char* soil_names[] = {"soil_0", "soil_1", "soil_2"};
    for (int i = 0; i < 3; i++) {
        int pin = atoi(soil_pins[i]);
        if (pin > 0) {
            g_soil_cfgs[i] = (SoilConfig){.pin = (uint8_t)pin};
            sensor_manager_add(&g_sensors, soil_names[i], NULL, soil_moisture_read, &g_soil_cfgs[i]);
        }
    }
}

static void publish_sensors(void)
{
    JsonDocument doc;
    char         payload[128];
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
    char payload[64];

    mqtt_topic_status(topic, sizeof(topic));
    snprintf(payload, sizeof(payload),
             "{\"rssi\":%ld,\"uptime\":%lu}",
             WiFi.RSSI(), millis() / 1000);
    mqtt_publish(topic, payload, false);
}

void setup()
{
    Serial.begin(115200);
    logger_init_global();

    sensor_manager_init(&g_sensors);
    register_sensors();
    sensor_manager_init_all(&g_sensors);

    WifiConfig wifi;
    wifi_load_env(&wifi);
    wifi_connect(&wifi);

    MqttConfig mqtt;
    mqtt_load_env(&mqtt);
    mqtt_init(&mqtt);
    mqtt_connect();
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

        if (mqtt_connected()) {
            publish_status();
            publish_sensors();
        }
    }
}
