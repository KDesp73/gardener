#include <Arduino.h>
#include <WiFi.h>
#include "logger.h"
#include "wifi_utils.h"

static const char* auth_type_str(wifi_auth_mode_t mode)
{
    switch (mode) {
    case WIFI_AUTH_OPEN:            return "open";
    case WIFI_AUTH_WEP:             return "WEP";
    case WIFI_AUTH_WPA_PSK:         return "WPA";
    case WIFI_AUTH_WPA2_PSK:        return "WPA2";
    case WIFI_AUTH_WPA_WPA2_PSK:    return "WPA+WPA2";
    case WIFI_AUTH_WPA2_ENTERPRISE: return "WPA2-EAP";
    case WIFI_AUTH_WPA3_PSK:        return "WPA3";
    case WIFI_AUTH_WPA2_WPA3_PSK:   return "WPA2+WPA3";
    case WIFI_AUTH_WAPI_PSK:        return "WAPI";
    default:                        return "unknown";
    }
}

void wifi_scan()
{
    LOG_INFO(&g_logger, "wifi", "Scan start");

    int n = WiFi.scanNetworks();
    if (n == 0) {
        LOG_INFO(&g_logger, "wifi", "No networks found");
    } else {
        LOG_INFO(&g_logger, "wifi", "%d network(s) found", n);

        LOG_INFO(&g_logger, "wifi", "Nr | SSID                             | RSSI | CH | Encryption");
        for (int i = 0; i < n; i++) {
            LOG_INFO(&g_logger, "wifi", "%-2d | %-32.32s | %4d | %2d | %s",
                     i + 1,
                     WiFi.SSID(i).c_str(),
                     WiFi.RSSI(i),
                     WiFi.channel(i),
                     auth_type_str(WiFi.encryptionType(i)));
            delay(10);
        }
    }

    WiFi.scanDelete();
    delay(5000);
}

static int parse_mac(const char* str, uint8_t bssid[6])
{
    if (!str || str[0] == '\0') return -1;
    return sscanf(str, "%hhx:%hhx:%hhx:%hhx:%hhx:%hhx",
                  &bssid[0], &bssid[1], &bssid[2],
                  &bssid[3], &bssid[4], &bssid[5]) == 6 ? 0 : -1;
}

int wifi_connect(const WifiConfig* cfg)
{
    const int max_attempts = 100;

    WiFi.mode(WIFI_STA);

    uint8_t bssid[6];
    bool have_bssid = (parse_mac(cfg->mac, bssid) == 0);

    if (have_bssid) {
        WiFi.begin(cfg->ssid, cfg->password, 0, bssid);
        LOG_INFO(&g_logger, "wifi", "Connecting to %s (BSSID: %s) ...", cfg->ssid, cfg->mac);
    } else {
        WiFi.begin(cfg->ssid, cfg->password);
        LOG_INFO(&g_logger, "wifi", "Connecting to %s ...", cfg->ssid);
    }

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < max_attempts) {
        delay(100);
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        LOG_INFO(&g_logger, "wifi", "Connected, IP: %s", WiFi.localIP().toString().c_str());
        return 0;
    }

    LOG_ERROR(&g_logger, "wifi", "Failed to connect after %d attempts", max_attempts);
    return -1;
}
