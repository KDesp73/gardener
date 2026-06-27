"use client";

import { useEffect, useState } from "react";
import { Sprout } from "lucide-react";
import {
  connectMqtt,
  disconnectMqtt,
  onSensorMessage,
  type SensorMessage,
} from "@/lib/mqtt-browser";
import { ZoneCard } from "@/components/zone-card";

type ZoneRow = {
  id: number;
  device_id: string;
  zone_id: number;
  name: string;
  sensor_type: string;
  soil_pin: number;
  relay_pin: number;
  dry_threshold: number;
  wet_threshold: number;
  max_run_sec: number;
  schedule_on: number;
  schedule_off: number;
  enabled: number;
  image?: string | null;
  plants?: string | null;
};

type TimedValue = { value: number; ts: number };

export function GardenDisplay({ zones: initialZones }: { zones: ZoneRow[] }) {
  const [readings, setReadings] = useState<Record<string, TimedValue>>({});

  useEffect(() => {
    const unsub = onSensorMessage((msg: SensorMessage) => {
      const key =
        msg.zoneId !== null
          ? `${msg.deviceId}:${msg.zoneId}:${msg.sensorType}`
          : `${msg.deviceId}:env:${msg.sensorType}`;

      setReadings((prev) => ({
        ...prev,
        [key]: { value: msg.value, ts: Date.now() },
      }));
    });

    connectMqtt();

    return () => {
      unsub();
      disconnectMqtt();
    };
  }, []);

  if (initialZones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Sprout className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">Your garden is empty</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          No plants have been added yet. Once your ESP32 devices are configured
          and zones are created, they will appear here.
        </p>
      </div>
    );
  }

  const activeZones = initialZones.filter((z) => z.enabled);
  const totalZones = initialZones.length;
  const offlineZones = totalZones - activeZones.length;

  return (
    <div className="space-y-8">
      {/* Garden header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Garden</h1>
          <p className="text-sm text-muted-foreground">
            {activeZones.length} plant{activeZones.length !== 1 ? "s" : ""} active
            {offlineZones > 0 && ` · ${offlineZones} inactive`}
          </p>
        </div>
      </div>

      {/* Zone grid */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {initialZones.map((z) => (
          <ZoneCard
            key={z.id}
            deviceId={z.device_id}
            zoneId={z.zone_id}
            name={z.name}
            image={z.image}
            plants={z.plants}
            sensorType={z.sensor_type || "capacitive"}
            soilPin={z.soil_pin}
            relayPin={z.relay_pin}
            dryThreshold={z.dry_threshold}
            wetThreshold={z.wet_threshold}
            maxRunSec={z.max_run_sec}
            scheduleOn={z.schedule_on}
            scheduleOff={z.schedule_off}
            enabled={!!z.enabled}
            readings={readings}
            readOnly
          />
        ))}
      </div>
    </div>
  );
}
