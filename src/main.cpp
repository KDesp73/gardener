#include <Arduino.h>
#include <string.h>
#include <stdlib.h>
#include "logger.h"
#include "env_config.h"
#include "wifi_utils.h"
#include "sensor.h"

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
}

void loop()
{
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

    delay(5000);
}
