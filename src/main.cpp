#include <Arduino.h>
#include "logger.h"

void setup()
{
    Serial.begin(115200);
    logger_init_global();

    LOG_INFO(&g_logger, "setup", "Setup complete");
}

void loop()
{
}
