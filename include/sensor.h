#ifndef SENSOR_H
#define SENSOR_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

#define SENSOR_MAX_COUNT 8
#define SENSOR_NAME_MAX  16

typedef struct {
    float value;
    bool  valid;
} SensorReading;

typedef void (*SensorInitFn)(void* config);
typedef SensorReading (*SensorReadFn)(void* config);

typedef struct {
    char           name[SENSOR_NAME_MAX];
    SensorInitFn   init;
    SensorReadFn   read;
    void*          config;
    SensorReading  last;
} Sensor;

typedef struct {
    Sensor  sensors[SENSOR_MAX_COUNT];
    uint8_t count;
} SensorManager;

void          sensor_manager_init(SensorManager* mgr);
void          sensor_manager_clear(SensorManager* mgr);
int           sensor_manager_add(SensorManager* mgr, const char* name, SensorInitFn init, SensorReadFn read, void* config);
int           sensor_manager_init_all(SensorManager* mgr);
int           sensor_manager_read_all(SensorManager* mgr);
int           sensor_manager_read_one(SensorManager* mgr, uint8_t index);
SensorReading sensor_manager_get(const SensorManager* mgr, const char* name);
SensorReading sensor_manager_get_by_index(const SensorManager* mgr, uint8_t index);
int           sensor_manager_count(const SensorManager* mgr);

// Built-in sensor configs
typedef struct {
    uint8_t pin;
    void*   handle;
} Dht22Config;

typedef struct {
    uint8_t pin;
} SoilConfig;

// Built-in sensor functions
void          dht22_init(void* config);
SensorReading dht22_read_temp(void* config);
SensorReading dht22_read_hum(void* config);
SensorReading soil_moisture_read(void* config);

#ifdef __cplusplus
}
#endif

#endif // SENSOR_H
