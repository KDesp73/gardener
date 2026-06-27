#include "mqtt.h"
#include "logger.h"
#include "env_config.h"
#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <string.h>
#include <stdlib.h>

#define TAG "mqtt"

#define RETRY_MIN_MS  1000
#define RETRY_MAX_MS  30000

static WiFiClientSecure g_wifi_client;
static PubSubClient    g_client(g_wifi_client);
static MqttConfig    g_cfg;
static MqttCallback  g_user_cb  = NULL;
static bool          g_initial  = true;
static unsigned long g_retry_ms = RETRY_MIN_MS;
static unsigned long g_last_retry = 0;

static void on_mqtt_message(char* topic, byte* payload, unsigned int len)
{
    char buf[256];
    unsigned int copy = len < sizeof(buf) - 1 ? len : sizeof(buf) - 1;
    memcpy(buf, payload, copy);
    buf[copy] = '\0';

    LOG_INFO(&g_logger, TAG, "RX %s: %s", topic, buf);

    if (g_user_cb) {
        g_user_cb(topic, buf, copy);
    }
}

void mqtt_init(const MqttConfig* cfg)
{
    memcpy(&g_cfg, cfg, sizeof(g_cfg));
    g_wifi_client.setInsecure();
    g_client.setServer(g_cfg.host, g_cfg.port);
    g_client.setCallback(on_mqtt_message);
}

int mqtt_connect(void)
{
    if (g_client.connected()) return 0;
    if (WiFi.status() != WL_CONNECTED) return -1;

    LOG_INFO(&g_logger, TAG, "Connecting to %s:%d as %s ...",
             g_cfg.host, g_cfg.port, g_cfg.device_id);

    bool ok;
    if (g_cfg.user[0] && g_cfg.pass[0]) {
        ok = g_client.connect(g_cfg.device_id, g_cfg.user, g_cfg.pass);
    } else {
        ok = g_client.connect(g_cfg.device_id);
    }

    if (ok) {
        LOG_INFO(&g_logger, TAG, "Connected to broker");
        g_retry_ms = RETRY_MIN_MS;

        if (g_initial) {
            char topic[MQTT_TOPIC_MAX];
            mqtt_topic_announce(topic, sizeof(topic));
            mqtt_publish(topic, "{\"device\":\"" MQTT_DEVICE_ID "\",\"version\":\"1.0\"}", true);

            mqtt_topic_cmd_water(topic, sizeof(topic), 0);
            mqtt_subscribe(topic);
            g_initial = false;
        }

        return 0;
    }

    LOG_WARN(&g_logger, TAG, "Connection failed (rc=%d)", g_client.state());
    return -1;
}

void mqtt_disconnect(void)
{
    if (g_client.connected()) {
        g_client.disconnect();
    }
}

bool mqtt_connected(void)
{
    return g_client.connected();
}

void mqtt_loop(void)
{
    if (!g_client.connected()) {
        unsigned long now = millis();
        if (now - g_last_retry >= g_retry_ms) {
            g_last_retry = now;
            if (mqtt_connect() != 0) {
                g_retry_ms *= 2;
                if (g_retry_ms > RETRY_MAX_MS) {
                    g_retry_ms = RETRY_MAX_MS;
                }
            }
        }
        return;
    }

    g_client.loop();
}

int mqtt_publish(const char* topic, const char* payload, bool retained)
{
    if (!g_client.connected()) return -1;
    bool ok = g_client.publish(topic, payload, retained);
    if (ok) {
        LOG_DEBUG(&g_logger, TAG, "TX %s: %s", topic, payload);
    }
    return ok ? 0 : -1;
}

int mqtt_subscribe(const char* topic)
{
    if (!g_client.connected()) return -1;
    bool ok = g_client.subscribe(topic);
    return ok ? 0 : -1;
}

void mqtt_set_callback(MqttCallback cb)
{
    g_user_cb = cb;
}

// ── Topic builders ────────────────────────────────────────────────────────

static void topic_base(char* buf, size_t size, const char* suffix)
{
    snprintf(buf, size, "gardener/%s/%s", g_cfg.device_id, suffix);
}

void mqtt_topic_status(char* buf, size_t size)
{
    topic_base(buf, size, "status");
}

void mqtt_topic_env(char* buf, size_t size)
{
    topic_base(buf, size, "env");
}

void mqtt_topic_soil(char* buf, size_t size, int zone)
{
    snprintf(buf, size, "gardener/%s/zone/%d/soil", g_cfg.device_id, zone);
}

void mqtt_topic_water(char* buf, size_t size, int zone)
{
    snprintf(buf, size, "gardener/%s/zone/%d/water", g_cfg.device_id, zone);
}

void mqtt_topic_cmd_water(char* buf, size_t size, int zone)
{
    snprintf(buf, size, "gardener/%s/zone/%d/cmd/water", g_cfg.device_id, zone);
}

void mqtt_topic_zone_config(char* buf, size_t size, int zone)
{
    snprintf(buf, size, "gardener/%s/zone/%d/config", g_cfg.device_id, zone);
}

void mqtt_topic_zone_config_wc(char* buf, size_t size)
{
    snprintf(buf, size, "gardener/%s/zone/+/config", g_cfg.device_id);
}

void mqtt_topic_announce(char* buf, size_t size)
{
    topic_base(buf, size, "announce");
}

// ── Env loader ─────────────────────────────────────────────────────────────

void mqtt_load_env(MqttConfig* cfg)
{
    memset(cfg, 0, sizeof(*cfg));

    strncpy(cfg->host, MQTT_HOST, sizeof(cfg->host) - 1);
    int port = atoi(MQTT_PORT);
    cfg->port = port > 0 ? (uint16_t)port : 1883;
    strncpy(cfg->user, MQTT_USERNAME, sizeof(cfg->user) - 1);

    strncpy(cfg->pass, MQTT_PASSWORD, sizeof(cfg->pass) - 1);
    if (MQTT_DEVICE_ID[0]) {
        strncpy(cfg->device_id, MQTT_DEVICE_ID, sizeof(cfg->device_id) - 1);
    } else {
        uint8_t mac[6];
        WiFi.macAddress(mac);
        snprintf(cfg->device_id, sizeof(cfg->device_id), "esp32_%02x%02x%02x%02x%02x%02x",
                 mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    }
}
