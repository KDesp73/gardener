export type SensorMessage = {
  deviceId: string;
  zoneId: number | null;
  sensorType: string;
  value: number;
  unit: string;
};

type MessageHandler = (msg: SensorMessage) => void;

const handlers = new Set<MessageHandler>();

let client: import("mqtt").MqttClient | null = null;

const TOPICS: { topic: string; sensorType: string; unit: string }[] = [
  { topic: "gardener/+/env", sensorType: "env", unit: "" },
  { topic: "gardener/+/zone/+/soil", sensorType: "moisture", unit: "" },
  { topic: "gardener/+/status", sensorType: "status", unit: "" },
  { topic: "gardener/+/announce", sensorType: "announce", unit: "" },
];

export function connectMqtt() {
  if (client) return;

  const url = process.env.NEXT_PUBLIC_MQTT_WS_URL;
  if (!url) {
    console.warn("MQTT WS URL not configured");
    return;
  }

  const username = process.env.NEXT_PUBLIC_MQTT_USERNAME || undefined;
  const password = process.env.NEXT_PUBLIC_MQTT_PASSWORD || undefined;

  import("mqtt").then(({ default: mqtt }) => {
    client = mqtt.connect(url, {
      username,
      password,
      clientId: `gardener-ui-${Math.random().toString(36).slice(2, 8)}`,
      clean: true,
    });

    client.on("connect", () => {
      for (const t of TOPICS) {
        client?.subscribe(t.topic);
      }
    });

    client.on("message", (rawTopic, payload) => {
      const topic = rawTopic.toString();
      const parts = topic.split("/");
      const deviceId = parts[1];

      let zoneId: number | null = null;
      if (parts[2] === "zone" && parts[3]) {
        zoneId = parseInt(parts[3], 10);
      }

      let text = payload.toString();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        return;
      }

      if (topic.endsWith("/env")) {
        if (typeof data.temp === "number") {
          emit({ deviceId, zoneId: null, sensorType: "temp", value: data.temp, unit: "°C" });
        }
        if (typeof data.hum === "number") {
          emit({ deviceId, zoneId: null, sensorType: "hum", value: data.hum, unit: "%" });
        }
      } else if (topic.endsWith("/soil")) {
        if (typeof data.moisture === "number") {
          emit({ deviceId, zoneId, sensorType: "moisture", value: data.moisture, unit: "" });
        }
      } else if (topic.endsWith("/status")) {
        if (typeof data.rssi === "number") {
          emit({ deviceId, zoneId: null, sensorType: "rssi", value: data.rssi, unit: "dBm" });
        }
        if (typeof data.uptime === "number") {
          emit({ deviceId, zoneId: null, sensorType: "uptime", value: data.uptime, unit: "s" });
        }
      } else if (topic.endsWith("/water")) {
        emit({ deviceId, zoneId, sensorType: "water", value: data.state === "on" ? 1 : 0, unit: "" });
      }
    });

    client.on("error", (err) => {
      console.warn("MQTT error:", err);
    });
  });
}

export function disconnectMqtt() {
  client?.end(true);
  client = null;
}

export function onSensorMessage(handler: MessageHandler) {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

function emit(msg: SensorMessage) {
  for (const h of handlers) {
    h(msg);
  }
}
