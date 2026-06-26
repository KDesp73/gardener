#ifndef WIFI_UTILS_H
#define WIFI_UTILS_H

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    char ssid[32];
    char password[64];
    char mac[128];
} WifiConfig;

void wifi_load_env(WifiConfig* cfg);
int  wifi_connect(const WifiConfig* cfg);
void wifi_scan(void);

#ifdef __cplusplus
}
#endif

#endif // WIFI_UTILS_H
