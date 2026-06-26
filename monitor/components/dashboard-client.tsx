"use client";

import { useEffect, useState } from "react";
import { connectMqtt, disconnectMqtt, onSensorMessage, type SensorMessage } from "@/lib/mqtt-browser";
import { ZoneCard } from "@/components/zone-card";
import { ZoneFormDialog } from "@/components/zone-form-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ZoneRow = {
  id: number;
  device_id: string;
  zone_id: number;
  name: string;
  soil_pin: number;
  relay_pin: number;
  dry_threshold: number;
  wet_threshold: number;
  enabled: number;
};

type DeviceRow = {
  id: string;
  name: string;
};

export function DashboardClient({
  zones,
  devices,
}: {
  zones: ZoneRow[];
  devices: DeviceRow[];
}) {
  const [readings, setReadings] = useState<Record<string, number>>({});
  const [env, setEnv] = useState<{ temp?: number; hum?: number }>({});

  useEffect(() => {
    const unsub = onSensorMessage((msg: SensorMessage) => {
      const key = msg.zoneId !== null
        ? `${msg.deviceId}:${msg.zoneId}:${msg.sensorType}`
        : `${msg.deviceId}:env:${msg.sensorType}`;

      setReadings((prev) => ({ ...prev, [key]: msg.value }));

      if (msg.sensorType === "temp") {
        setEnv((prev) => ({ ...prev, temp: msg.value }));
      } else if (msg.sensorType === "hum") {
        setEnv((prev) => ({ ...prev, hum: msg.value }));
      }
    });

    connectMqtt();

    return () => {
      unsub();
      disconnectMqtt();
    };
  }, []);

  const nextZoneId =
    zones.length > 0
      ? Math.max(...zones.map((z) => z.zone_id)) + 1
      : 0;

  return (
    <div className="space-y-6">
      {/* Environment */}
      {env.temp !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle>Environment</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-6">
            <div className="text-2xl font-semibold">
              {env.temp?.toFixed(1)}°C
            </div>
            <div className="text-2xl font-semibold">
              {env.hum?.toFixed(0)}% RH
            </div>
          </CardContent>
        </Card>
      )}

      {/* Zones */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Plants</h2>
        <ZoneFormDialog
          devices={devices.map((d) => ({ id: d.id, name: d.name || d.id }))}
          nextZoneId={nextZoneId}
        />
      </div>

      {zones.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No plants configured yet. Add one to get started.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {zones.map((z) => (
          <ZoneCard
            key={z.id}
            deviceId={z.device_id}
            zoneId={z.zone_id}
            name={z.name}
            dryThreshold={z.dry_threshold}
            wetThreshold={z.wet_threshold}
            enabled={!!z.enabled}
            readings={readings}
          />
        ))}
      </div>
    </div>
  );
}
