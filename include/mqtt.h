#ifndef GARDENER_MQTT_H
#define GARDENER_MQTT_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#define MQTT_TOPIC_MAX   128
#define MQTT_HOST_MAX    64
#define MQTT_USER_MAX    32
#define MQTT_PASS_MAX    32
#define MQTT_ID_MAX      32

typedef struct {
    char     host[MQTT_HOST_MAX];
    uint16_t port;
    char     user[MQTT_USER_MAX];
    char     pass[MQTT_PASS_MAX];
    char     device_id[MQTT_ID_MAX];
} MqttConfig;

typedef void (*MqttCallback)(const char* topic, const char* payload, uint16_t len);

void mqtt_init(const MqttConfig* cfg);
int  mqtt_connect(void);
void mqtt_disconnect(void);
bool mqtt_connected(void);
void mqtt_loop(void);
int  mqtt_publish(const char* topic, const char* payload, bool retained);
int  mqtt_subscribe(const char* topic);
void mqtt_set_callback(MqttCallback cb);

void mqtt_topic_status(char* buf, size_t size);
void mqtt_topic_env(char* buf, size_t size);
void mqtt_topic_soil(char* buf, size_t size, int zone);
void mqtt_topic_water(char* buf, size_t size, int zone);
void mqtt_topic_cmd_water(char* buf, size_t size, int zone);
void mqtt_topic_zone_config(char* buf, size_t size, int zone);
void mqtt_topic_zone_config_wc(char* buf, size_t size);
void mqtt_topic_announce(char* buf, size_t size);

void mqtt_load_env(MqttConfig* cfg);

#ifdef __cplusplus
}
#endif

#endif // GARDENER_MQTT_H
