#include <Arduino.h>
#include "logger.h"
#include "wifi_utils.h"

void setup()
{
    Serial.begin(115200);
    logger_init_global();

    WifiConfig wifi;
    wifi_load_env(&wifi);

    wifi_connect(&wifi);
}

void loop()
{
}
