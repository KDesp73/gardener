#include "logger.h"
#include <Arduino.h>
#include <stdio.h>
#include <string.h>

static const char* const LEVEL_NAMES[] = {
    "DEBUG",
    "INFO",
    "WARN",
    "ERROR",
    "NONE"
};

void logger_init(Logger* log)
{
    log->target_count    = 0;
    log->global_min_level = LOG_LEVEL_DEBUG;

    for (int i = 0; i < LOGGER_MAX_TARGETS; i++) {
        log->targets[i].enabled   = false;
        log->targets[i].min_level = LOG_LEVEL_DEBUG;
        log->targets[i].write     = NULL;
        log->targets[i].context   = NULL;
    }
}

int logger_add_target(Logger* log, LogWriteFn write, void* context, LogLevel min_level)
{
    if (!write || log->target_count >= LOGGER_MAX_TARGETS) {
        return -1;
    }

    int idx = log->target_count;
    log->targets[idx].write     = write;
    log->targets[idx].context   = context;
    log->targets[idx].min_level = min_level;
    log->targets[idx].enabled   = true;
    log->target_count++;
    return idx;
}

void logger_set_target_level(Logger* log, uint8_t index, LogLevel level)
{
    if (index < log->target_count) {
        log->targets[index].min_level = level;
    }
}

void logger_enable_target(Logger* log, uint8_t index, bool enabled)
{
    if (index < log->target_count) {
        log->targets[index].enabled = enabled;
    }
}

void logger_set_global_level(Logger* log, LogLevel level)
{
    log->global_min_level = level;
}

const char* logger_level_string(LogLevel level)
{
    if ((int)level < 0 || (int)level >= (int)(sizeof(LEVEL_NAMES) / sizeof(LEVEL_NAMES[0]))) {
        return "????";
    }
    return LEVEL_NAMES[level];
}

void logger_logv(Logger* log, LogLevel level, const char* tag, const char* fmt, va_list args)
{
    if (!log || !fmt || level < log->global_min_level) {
        return;
    }

    char buf[LOGGER_MSG_BUFFER_SIZE];
    int total = 0;

    int written = snprintf(buf, sizeof(buf), "[%s] [%s] ",
                           logger_level_string(level), tag ? tag : "");
    if (written < 0) return;
    total = written;

    if (total < (int)sizeof(buf) - 2) {
        vsnprintf(buf + total, sizeof(buf) - total, fmt, args);
    }

    buf[sizeof(buf) - 1] = '\0';

    for (int i = 0; i < log->target_count; i++) {
        LogTarget* t = &log->targets[i];
        if (!t->enabled || !t->write || level < t->min_level) {
            continue;
        }
        t->write(buf, t->context);
    }
}

void logger_log(Logger* log, LogLevel level, const char* tag, const char* fmt, ...)
{
    va_list args;
    va_start(args, fmt);
    logger_logv(log, level, tag, fmt, args);
    va_end(args);
}

Logger g_logger;

void logger_init_global(void)
{
    logger_init(&g_logger);
    logger_add_target(&g_logger, logger_write_serial, NULL, LOG_LEVEL_DEBUG);
    LOG_INFO(&g_logger, "logger", "Global logger initialized");
}

void logger_write_serial(const char* msg, void* context)
{
    (void)context;
    Serial.println(msg);
}
