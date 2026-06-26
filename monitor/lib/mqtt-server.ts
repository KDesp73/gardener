import mqtt from "mqtt";

export async function publishConfig(
  deviceId: string,
  zoneId: number,
  config: Record<string, unknown>,
) {
  const host = process.env.MQTT_HOST || "localhost";
  const port = parseInt(process.env.MQTT_PORT || "1883");
  const username = process.env.MQTT_USERNAME || "";
  const password = process.env.MQTT_PASSWORD || "";

  const url = `mqtt://${host}:${port}`;
  const client = mqtt.connect(url, {
    username: username || undefined,
    password: password || undefined,
    clientId: `gardener-monitor-${Date.now()}`,
  });

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.end(true);
      reject(new Error("MQTT publish timeout"));
    }, 5000);

    client.on("connect", () => {
      const topic = `gardener/${deviceId}/zone/${zoneId}/config`;
      const payload = JSON.stringify(config);

      client.publish(topic, payload, { qos: 1, retain: true }, (err) => {
        clearTimeout(timeout);
        client.end(true);
        if (err) reject(err);
        else resolve();
      });
    });

    client.on("error", (err) => {
      clearTimeout(timeout);
      client.end(true);
      reject(err);
    });
  });
}
