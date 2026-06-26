export type SensorMessage = {
  deviceId: string;
  zoneId: number | null;
  sensorType: string;
  value: number;
  unit: string;
};

export type AnnounceMessage = {
  deviceId: string;
  version: string;
};

export type StatusMessage = {
  deviceId: string;
  rssi: number;
  uptime: number;
  freeHeap?: number;
  sensorsOk?: number;
  sensorsTotal?: number;
};

type MessageHandler = (msg: SensorMessage) => void;
type AnnounceHandler = (msg: AnnounceMessage) => void;
type StatusHandler = (msg: StatusMessage) => void;

const sensorHandlers = new Set<MessageHandler>();
const announceHandlers = new Set<AnnounceHandler>();
const statusHandlers = new Set<StatusHandler>();

let client: import("mqtt").MqttClient | null = null;

const TOPICS = [
  "gardener/+/env",
  "gardener/+/zone/+/soil",
  "gardener/+/status",
  "gardener/+/announce",
  "gardener/+/zone/+/water",
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
        client?.subscribe(t);
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
          emitSensor({ deviceId, zoneId: null, sensorType: "temp", value: data.temp, unit: "°C" });
        }
        if (typeof data.hum === "number") {
          emitSensor({ deviceId, zoneId: null, sensorType: "hum", value: data.hum, unit: "%" });
        }
      } else if (topic.endsWith("/soil")) {
        if (typeof data.moisture === "number") {
          emitSensor({ deviceId, zoneId, sensorType: "moisture", value: data.moisture, unit: "" });
        }
      } else if (topic.endsWith("/status")) {
        const msg: StatusMessage = {
          deviceId,
          rssi: typeof data.rssi === "number" ? data.rssi : 0,
          uptime: typeof data.uptime === "number" ? data.uptime : 0,
          freeHeap: typeof data.free_heap === "number" ? data.free_heap : undefined,
          sensorsOk: typeof data.sensors_ok === "number" ? data.sensors_ok : undefined,
          sensorsTotal: typeof data.sensors_total === "number" ? data.sensors_total : undefined,
        };
        emitStatus(msg);
        if (typeof data.rssi === "number") {
          emitSensor({ deviceId, zoneId: null, sensorType: "rssi", value: data.rssi, unit: "dBm" });
        }
        if (typeof data.uptime === "number") {
          emitSensor({ deviceId, zoneId: null, sensorType: "uptime", value: data.uptime, unit: "s" });
        }
      } else if (topic.endsWith("/water")) {
        emitSensor({ deviceId, zoneId, sensorType: "water", value: data.state === "on" ? 1 : 0, unit: "" });
      } else if (topic.endsWith("/announce")) {
        emitAnnounce({
          deviceId,
          version: typeof data.version === "string" ? data.version : "unknown",
        });
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

// ── Subscriptions ──────────────────────────────────────────────────────────

export function onSensorMessage(handler: MessageHandler) {
  sensorHandlers.add(handler);
  return () => sensorHandlers.delete(handler);
}

export function onAnnounce(handler: AnnounceHandler) {
  announceHandlers.add(handler);
  return () => announceHandlers.delete(handler);
}

export function onStatus(handler: StatusHandler) {
  statusHandlers.add(handler);
  return () => statusHandlers.delete(handler);
}

function emitSensor(msg: SensorMessage) {
  for (const h of sensorHandlers) h(msg);
}

function emitAnnounce(msg: AnnounceMessage) {
  for (const h of announceHandlers) h(msg);
}

function emitStatus(msg: StatusMessage) {
  for (const h of statusHandlers) h(msg);
}
