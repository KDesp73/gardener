#ifndef LOGGER_H
#define LOGGER_H

#include <stdint.h>
#include <stdbool.h>
#include <stdarg.h>

#ifdef __cplusplus
extern "C" {
#endif

#define LOGGER_MAX_TARGETS      4
#define LOGGER_MSG_BUFFER_SIZE  256

typedef enum {
    LOG_LEVEL_DEBUG = 0,
    LOG_LEVEL_INFO,
    LOG_LEVEL_WARN,
    LOG_LEVEL_ERROR,
    LOG_LEVEL_NONE
} LogLevel;

typedef void (*LogWriteFn)(const char* msg, void* context);

typedef struct {
    bool        enabled;
    LogLevel    min_level;
    LogWriteFn  write;
    void*       context;
} LogTarget;

typedef struct {
    LogTarget   targets[LOGGER_MAX_TARGETS];
    uint8_t     target_count;
    LogLevel    global_min_level;
} Logger;

void logger_init(Logger* log);
int  logger_add_target(Logger* log, LogWriteFn write, void* context, LogLevel min_level);
void logger_set_target_level(Logger* log, uint8_t index, LogLevel level);
void logger_enable_target(Logger* log, uint8_t index, bool enabled);
void logger_set_global_level(Logger* log, LogLevel level);
void logger_log(Logger* log, LogLevel level, const char* tag, const char* fmt, ...);
void logger_logv(Logger* log, LogLevel level, const char* tag, const char* fmt, va_list args);

const char* logger_level_string(LogLevel level);

void    logger_write_serial(const char* msg, void* context);

extern Logger g_logger;

void logger_init_global(void);

#define LOG_DEBUG(log, tag, fmt, ...)  logger_log(log, LOG_LEVEL_DEBUG, tag, fmt, ##__VA_ARGS__)
#define LOG_INFO(log, tag, fmt, ...)   logger_log(log, LOG_LEVEL_INFO,  tag, fmt, ##__VA_ARGS__)
#define LOG_WARN(log, tag, fmt, ...)   logger_log(log, LOG_LEVEL_WARN,  tag, fmt, ##__VA_ARGS__)
#define LOG_ERROR(log, tag, fmt, ...)  logger_log(log, LOG_LEVEL_ERROR, tag, fmt, ##__VA_ARGS__)

#ifdef __cplusplus
}
#endif

#endif // LOGGER_H
