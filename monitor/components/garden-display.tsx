"use client";

import { useEffect, useState } from "react";
import { Sprout, Droplets, Thermometer, Heart } from "lucide-react";
import { PlantCard } from "@/components/plant-card";
import {
  connectMqtt,
  disconnectMqtt,
  onSensorMessage,
  type SensorMessage,
} from "@/lib/mqtt-browser";

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

const STALE_AFTER_MS = 30_000;

function isDry(
  moisture: number,
  dryThreshold: number,
  wetThreshold: number,
  sensorType: string,
) {
  return sensorType === "resistive"
    ? moisture >= dryThreshold
    : moisture <= dryThreshold;
}

function isWet(
  moisture: number,
  dryThreshold: number,
  wetThreshold: number,
  sensorType: string,
) {
  return sensorType === "resistive"
    ? moisture <= wetThreshold
    : moisture >= wetThreshold;
}

function getStatus(
  moisture: number | undefined,
  moistureTs: number | undefined,
  dryThreshold: number,
  wetThreshold: number,
  sensorType: string,
): "dry" | "wet" | "ok" | "unknown" {
  if (moisture === undefined || moistureTs === undefined) return "unknown";
  if (Date.now() - moistureTs > STALE_AFTER_MS) return "unknown";
  if (isDry(moisture, dryThreshold, wetThreshold, sensorType)) return "dry";
  if (isWet(moisture, dryThreshold, wetThreshold, sensorType)) return "wet";
  return "ok";
}

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

  // Compute overall stats
  const totalZones = initialZones.filter((z) => z.enabled).length;
  let totalPlants = 0;
  let dryCount = 0;
  let healthyCount = 0;
  let temp: number | undefined;
  let hum: number | undefined;

  for (const z of initialZones) {
    if (z.plants) {
      try {
        const p = JSON.parse(z.plants);
        if (Array.isArray(p)) {
          totalPlants += p.reduce((s: number, pl: any) => s + (pl.count ?? 1), 0);
        }
      } catch {}
    }

    const moistureKey = `${z.device_id}:${z.zone_id}:moisture`;
    const m = readings[moistureKey];
    const status = getStatus(
      m?.value,
      m?.ts,
      z.dry_threshold,
      z.wet_threshold,
      z.sensor_type || "capacitive",
    );
    if (status === "dry") dryCount++;
    if (status === "ok" || status === "wet") healthyCount++;

    // Env readings from first device
    if (!temp) {
      const t = readings[`${z.device_id}:env:temp`];
      if (t) temp = t.value;
    }
    if (!hum) {
      const h = readings[`${z.device_id}:env:hum`];
      if (h) hum = h.value;
    }
  }

  const empty = initialZones.length === 0;

  return (
    <div className="space-y-10">
      {/* Garden header */}
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              My Garden
            </h1>
            {!empty && (
              <p className="text-sm text-muted-foreground">
                {totalPlants} plant{totalPlants !== 1 ? "s" : ""} across {totalZones} spot{totalZones !== 1 ? "s" : ""}
                {healthyCount > 0 && (
                  <span className="ml-1.5 text-emerald-600">· {healthyCount} healthy</span>
                )}
                {dryCount > 0 && (
                  <span className="ml-1.5 text-amber-600">· {dryCount} thirsty</span>
                )}
              </p>
            )}
          </div>
          {/* Weather pills */}
          {(temp !== undefined || hum !== undefined) && (
            <div className="flex items-center gap-2">
              {temp !== undefined && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                  <Thermometer className="h-3.5 w-3.5" />
                  {temp.toFixed(0)}°
                </span>
              )}
              {hum !== undefined && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                  <Droplets className="h-3.5 w-3.5" />
                  {hum.toFixed(0)}%
                </span>
              )}
            </div>
          )}
        </div>
        <div className="border-t border-border" />
      </div>

      {/* Empty state */}
      {empty ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-emerald-50">
            <Sprout className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">No plants yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Plants will appear here once zones are configured through the dashboard.
          </p>
        </div>
      ) : (
        <>
          {/* Garden grid */}
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {initialZones.map((z) => {
              const moistureKey = `${z.device_id}:${z.zone_id}:moisture`;
              const m = readings[moistureKey];
              return (
                <PlantCard
                  key={z.id}
                  name={z.name}
                  image={z.image}
                  plants={z.plants}
                  moisture={m?.value}
                  moistureTs={m?.ts}
                  status={getStatus(
                    m?.value,
                    m?.ts,
                    z.dry_threshold,
                    z.wet_threshold,
                    z.sensor_type || "capacitive",
                  )}
                  enabled={!!z.enabled}
                />
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-1 pb-6 text-center text-xs text-muted-foreground">
            <span>Made with</span>
            <Heart className="h-3 w-3 fill-current" />
            <span>by </span>
            <a
              href="https://github.com/KDesp73"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2 hover:text-foreground"
            >
              KDesp73
            </a>
          </div>
        </>
      )}
    </div>
  );
}
