#include "sensor.h"
#include "logger.h"
#include <Arduino.h>
#include <string.h>
#include <DHT.h>

#define TAG "sensor"

// ── SensorManager ──────────────────────────────────────────────────────────

void sensor_manager_init(SensorManager* mgr)
{
    mgr->count = 0;
    for (int i = 0; i < SENSOR_MAX_COUNT; i++) {
        Sensor* s = &mgr->sensors[i];
        s->name[0]   = '\0';
        s->init   = NULL;
        s->read   = NULL;
        s->config = NULL;
        s->last   = (SensorReading){0.0f, false};
    }
}

int sensor_manager_add(SensorManager* mgr, const char* name,
                       SensorInitFn init, SensorReadFn read, void* config)
{
    if (!mgr || !name || !read || mgr->count >= SENSOR_MAX_COUNT) {
        return -1;
    }
    Sensor* s = &mgr->sensors[mgr->count];
    strncpy(s->name, name, SENSOR_NAME_MAX - 1);
    s->name[SENSOR_NAME_MAX - 1] = '\0';
    s->init   = init;
    s->read   = read;
    s->config = config;
    s->last   = (SensorReading){0.0f, false};
    return mgr->count++;
}

int sensor_manager_init_all(SensorManager* mgr)
{
    int inited = 0;
    for (int i = 0; i < mgr->count; i++) {
        Sensor* s = &mgr->sensors[i];
        if (s->init) {
            s->init(s->config);
            inited++;
        }
    }
    return inited;
}

int sensor_manager_read_all(SensorManager* mgr)
{
    for (int i = 0; i < mgr->count; i++) {
        Sensor* s = &mgr->sensors[i];
        s->last = s->read(s->config);
    }
    return mgr->count;
}

int sensor_manager_read_one(SensorManager* mgr, uint8_t index)
{
    if (index >= mgr->count || !mgr->sensors[index].read) return -1;
    mgr->sensors[index].last = mgr->sensors[index].read(mgr->sensors[index].config);
    return 0;
}

SensorReading sensor_manager_get(const SensorManager* mgr, const char* name)
{
    for (int i = 0; i < mgr->count; i++) {
        if (strcmp(mgr->sensors[i].name, name) == 0) {
            return mgr->sensors[i].last;
        }
    }
    return (SensorReading){0.0f, false};
}

SensorReading sensor_manager_get_by_index(const SensorManager* mgr, uint8_t index)
{
    if (index >= mgr->count) return (SensorReading){0.0f, false};
    return mgr->sensors[index].last;
}

int sensor_manager_count(const SensorManager* mgr)
{
    return mgr->count;
}

// ── DHT22 ──────────────────────────────────────────────────────────────────

void dht22_init(void* config)
{
    Dht22Config* cfg = (Dht22Config*)config;
    cfg->handle = new DHT(cfg->pin, DHT22);
    ((DHT*)cfg->handle)->begin();
    LOG_INFO(&g_logger, TAG, "DHT22 on pin %d initialized", cfg->pin);
}

SensorReading dht22_read_temp(void* config)
{
    Dht22Config* cfg = (Dht22Config*)config;
    if (!cfg->handle) return (SensorReading){0.0f, false};

    float t = ((DHT*)cfg->handle)->readTemperature();
    return (SensorReading){t, !isnan(t)};
}

SensorReading dht22_read_hum(void* config)
{
    Dht22Config* cfg = (Dht22Config*)config;
    if (!cfg->handle) return (SensorReading){0.0f, false};

    float h = ((DHT*)cfg->handle)->readHumidity();
    return (SensorReading){h, !isnan(h)};
}

// ── Soil Moisture ──────────────────────────────────────────────────────────

SensorReading soil_moisture_read(void* config)
{
    SoilConfig* cfg = (SoilConfig*)config;
    int raw = analogRead(cfg->pin);
    return (SensorReading){(float)raw, true};
}
