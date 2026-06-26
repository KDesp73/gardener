#include "zone.h"
#include "logger.h"
#include <Arduino.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <string.h>

#define TAG      "zone"
#define NVS_NS   "gardener"
#define NVS_KEY  "zones"

ZoneManager g_zone_mgr;

static Preferences g_prefs;

void zone_manager_init(void)
{
    memset(&g_zone_mgr, 0, sizeof(g_zone_mgr));

    g_prefs.begin(NVS_NS, true);
    size_t sz = g_prefs.getBytesLength(NVS_KEY);
    if (sz > 0) {
        size_t read = g_prefs.getBytes(NVS_KEY, &g_zone_mgr, sizeof(g_zone_mgr));
        if (read == sizeof(g_zone_mgr)) {
            LOG_INFO(&g_logger, TAG, "Loaded %d zone(s) from NVS", g_zone_mgr.count);
        } else {
            LOG_WARN(&g_logger, TAG, "NVS zone data corrupt, starting fresh");
            memset(&g_zone_mgr, 0, sizeof(g_zone_mgr));
        }
    } else {
        LOG_INFO(&g_logger, TAG, "No zones in NVS, starting empty");
    }
    g_prefs.end();
}

void zone_manager_save(void)
{
    g_prefs.begin(NVS_NS, false);
    g_prefs.putBytes(NVS_KEY, &g_zone_mgr, sizeof(g_zone_mgr));
    g_prefs.end();
    LOG_INFO(&g_logger, TAG, "Saved %d zone(s) to NVS", g_zone_mgr.count);
}

static ZoneConfig* find_zone(uint8_t id)
{
    for (int i = 0; i < g_zone_mgr.count; i++) {
        if (g_zone_mgr.zones[i].id == id) return &g_zone_mgr.zones[i];
    }
    return NULL;
}

int zone_manager_add(const ZoneConfig* cfg)
{
    if (find_zone(cfg->id)) return -1;          // already exists
    if (g_zone_mgr.count >= ZONES_MAX) return -1;

    ZoneConfig* z = &g_zone_mgr.zones[g_zone_mgr.count++];
    memcpy(z, cfg, sizeof(ZoneConfig));
    zone_manager_save();
    LOG_INFO(&g_logger, TAG, "Added zone %d: %s", z->id, z->name);
    return 0;
}

int zone_manager_remove(uint8_t id)
{
    for (int i = 0; i < g_zone_mgr.count; i++) {
        if (g_zone_mgr.zones[i].id == id) {
            int remaining = g_zone_mgr.count - i - 1;
            if (remaining > 0) {
                memmove(&g_zone_mgr.zones[i], &g_zone_mgr.zones[i + 1],
                        remaining * sizeof(ZoneConfig));
            }
            g_zone_mgr.count--;
            zone_manager_save();
            LOG_INFO(&g_logger, TAG, "Removed zone %d", id);
            return 0;
        }
    }
    return -1;
}

int zone_manager_apply_json(uint8_t id, const char* json, size_t len)
{
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, json, len);
    if (err) {
        LOG_WARN(&g_logger, TAG, "JSON parse error: %s", err.c_str());
        return -1;
    }

    ZoneConfig* z = find_zone(id);

    if (doc["enabled"] == false) {
        if (z) zone_manager_remove(id);
        return 0;
    }

    ZoneConfig cfg;
    memset(&cfg, 0, sizeof(cfg));
    cfg.id = id;

    const char* name = doc["name"] | "";
    strncpy(cfg.name, name, ZONE_NAME_MAX - 1);
    cfg.soil_pin     = doc["soil_pin"]     | 0;
    cfg.relay_pin    = doc["relay_pin"]    | 0;
    cfg.dry_threshold = doc["dry"]         | 0;
    cfg.wet_threshold = doc["wet"]         | 0;
    cfg.max_run_sec  = doc["max_run"]      | 0;
    cfg.schedule_on  = doc["schedule_on"]  | 0;
    cfg.schedule_off = doc["schedule_off"] | 0;
    cfg.enabled      = doc["enabled"]      | true;

    if (z) {
        memcpy(z, &cfg, sizeof(ZoneConfig));
        LOG_INFO(&g_logger, TAG, "Updated zone %d: %s", id, cfg.name);
    } else {
        zone_manager_add(&cfg);
    }

    zone_manager_save();
    return 1;   // 1 = changed
}

int zone_manager_count(void)
{
    return g_zone_mgr.count;
}

const ZoneConfig* zone_manager_get(uint8_t id)
{
    ZoneConfig* z = find_zone(id);
    return z;
}
