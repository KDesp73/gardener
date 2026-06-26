#ifndef GARDENER_ZONE_H
#define GARDENER_ZONE_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#define ZONE_NAME_MAX  16
#define ZONES_MAX      8

typedef struct {
    uint8_t  id;
    char     name[ZONE_NAME_MAX];
    uint8_t  soil_pin;
    uint8_t  relay_pin;
    uint16_t dry_threshold;
    uint16_t wet_threshold;
    uint16_t max_run_sec;
    uint16_t schedule_on;    // minutes from midnight
    uint16_t schedule_off;
    bool     enabled;
    uint8_t  sensor_type;    // 0 = capacitive, 1 = resistive
} ZoneConfig;

typedef struct {
    ZoneConfig zones[ZONES_MAX];
    uint8_t    count;
} ZoneManager;

extern ZoneManager g_zone_mgr;

void zone_manager_init(void);
int  zone_manager_add(const ZoneConfig* cfg);
int  zone_manager_remove(uint8_t id);
int  zone_manager_apply_json(uint8_t id, const char* json, size_t len);
void zone_manager_save(void);
int  zone_manager_count(void);
const ZoneConfig* zone_manager_get(uint8_t id);

#ifdef __cplusplus
}
#endif

#endif // GARDENER_ZONE_H
