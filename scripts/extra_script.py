import os
from os.path import join

Import("env")

PROJECT_DIR = env.subst("$PROJECT_DIR")
ENV_FILE = join(PROJECT_DIR, ".env")
OUTPUT = join(PROJECT_DIR, "include", "env_config.h")

def generate_env_header():
    config = {}
    if os.path.isfile(ENV_FILE):
        with open(ENV_FILE) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                config[key.strip()] = val.strip()

    lines = [
        "#ifndef ENV_CONFIG_H",
        "#define ENV_CONFIG_H",
        "",
    ]

    keys = [
        "WIFI_SSID", "WIFI_PASSWORD", "WIFI_MAC",
        "DHT22_PIN",
        "SOIL_0_PIN", "SOIL_1_PIN", "SOIL_2_PIN",
    ]
    for k in keys:
        v = config.get(k, "")
        if v:
            escaped = v.replace("\\", "\\\\").replace('"', '\\"')
            lines.append(f'#define {k} "{escaped}"')
        else:
            lines.append(f'#define {k} ""')

    lines += [
        "",
        "#endif // ENV_CONFIG_H",
        "",
    ]

    with open(OUTPUT, "w") as f:
        f.write("\n".join(lines))

    print(f"[env] Generated {OUTPUT}")

generate_env_header()
