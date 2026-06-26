"use client";

import { useEffect, useState, useCallback } from "react";
import {
  connectMqtt,
  disconnectMqtt,
  onSensorMessage,
  onAnnounce,
  onStatus,
  type SensorMessage,
  type AnnounceMessage,
  type StatusMessage,
} from "@/lib/mqtt-browser";
import { ZoneCard } from "@/components/zone-card";
import { ZoneFormDialog } from "@/components/zone-form-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { discoverDevice } from "@/app/actions";
import { Badge } from "@/components/ui/badge";

const STALE_AFTER_MS = 30_000;

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
};

type DeviceRow = {
  id: string;
  name: string;
};

type TimedValue = { value: number; ts: number };
type DeviceHealth = {
  rssi?: number;
  uptime?: number;
  freeHeap?: number;
  sensorsOk?: number;
  sensorsTotal?: number;
  lastSeen: number;
};

function DevicePanel({
  deviceId,
  health,
}: {
  deviceId: string;
  health: DeviceHealth | null;
}) {
  if (!health) return null;

  const { rssi, uptime, freeHeap, sensorsOk, sensorsTotal, lastSeen } = health;
  const stale = Date.now() - lastSeen > STALE_AFTER_MS;

  const rssiBars =
    rssi !== undefined
      ? rssi >= -50 ? 4 : rssi >= -65 ? 3 : rssi >= -80 ? 2 : 1
      : 0;

  return (
    <Card className={stale ? "opacity-60" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {deviceId}
          {stale && <Badge variant="outline">offline</Badge>}
          {!stale && <Badge variant="secondary">online</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Signal</span>
            {rssi !== undefined ? (
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4].map((bar) => (
                  <div
                    key={bar}
                    className={`w-1 rounded-full ${bar <= rssiBars ? "bg-foreground" : "bg-muted-foreground/30"}`}
                    style={{ height: `${bar * 4 + 4}px` }}
                  />
                ))}
                <span className="ml-1 font-mono text-xs">{rssi} dBm</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>

          <span className="text-muted-foreground">·</span>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Uptime</span>
            <span className="font-mono text-xs">
              {uptime !== undefined
                ? uptime >= 86400
                  ? `${(uptime / 86400).toFixed(0)}d`
                  : uptime >= 3600
                    ? `${(uptime / 3600).toFixed(0)}h`
                    : `${(uptime / 60).toFixed(0)}m`
                : "—"}
            </span>
          </div>

          <span className="text-muted-foreground">·</span>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Heap</span>
            <span className="font-mono text-xs">
              {freeHeap !== undefined
                ? `${(freeHeap / 1024).toFixed(0)} KB`
                : "—"}
            </span>
          </div>

          <span className="text-muted-foreground">·</span>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Sensors</span>
            <span className="font-mono text-xs">
              {sensorsOk !== undefined && sensorsTotal !== undefined
                ? `${sensorsOk}/${sensorsTotal}`
                : "—"}
            </span>
            {sensorsOk !== undefined && sensorsTotal !== undefined && sensorsOk < sensorsTotal && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                {sensorsTotal - sensorsOk} failed
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardClient({
  zones: initialZones,
  devices: initialDevices,
}: {
  zones: ZoneRow[];
  devices: DeviceRow[];
}) {
  const [readings, setReadings] = useState<Record<string, TimedValue>>({});
  const [health, setHealth] = useState<Record<string, DeviceHealth>>({});
  const [zones, setZones] = useState(initialZones);
  const [devices, setDevices] = useState(initialDevices);

  useEffect(() => {
    const unsubSensor = onSensorMessage((msg: SensorMessage) => {
      const key =
        msg.zoneId !== null
          ? `${msg.deviceId}:${msg.zoneId}:${msg.sensorType}`
          : `${msg.deviceId}:env:${msg.sensorType}`;

      setReadings((prev) => ({
        ...prev,
        [key]: { value: msg.value, ts: Date.now() },
      }));
    });

    const unsubAnnounce = onAnnounce((msg: AnnounceMessage) => {
      discoverDevice(msg.deviceId, msg.deviceId);
      setDevices((prev) => {
        if (prev.find((d) => d.id === msg.deviceId)) return prev;
        return [...prev, { id: msg.deviceId, name: msg.deviceId }];
      });
    });

    const unsubStatus = onStatus((msg: StatusMessage) => {
      setHealth((prev) => ({
        ...prev,
        [msg.deviceId]: {
          rssi: msg.rssi,
          uptime: msg.uptime,
          freeHeap: msg.freeHeap,
          sensorsOk: msg.sensorsOk,
          sensorsTotal: msg.sensorsTotal,
          lastSeen: Date.now(),
        },
      }));
    });

    connectMqtt();

    return () => {
      unsubSensor();
      unsubAnnounce();
      unsubStatus();
      disconnectMqtt();
    };
  }, []);

  const deviceIds = [...new Set(zones.map((z) => z.device_id))];

  // Also include any device we've heard from via MQTT
  for (const id of Object.keys(health)) {
    if (!deviceIds.includes(id)) deviceIds.push(id);
  }

  const nextZoneId =
    zones.length > 0 ? Math.max(...zones.map((z) => z.zone_id)) + 1 : 0;

  return (
    <div className="space-y-6">
      {/* Device panels */}
      {deviceIds.map((did) => (
        <DevicePanel key={did} deviceId={did} health={health[did] || null} />
      ))}

      {/* Zones header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Plants</h2>
          <p className="text-sm text-muted-foreground">
            {zones.filter((z) => z.enabled).length} active
            {zones.length > 0 && ` · ${zones.length} total`}
          </p>
        </div>
        <ZoneFormDialog
          devices={devices.map((d) => ({ id: d.id, name: d.name || d.id }))}
          nextZoneId={nextZoneId}
        />
      </div>

      {zones.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No plants configured yet. Add one to get started.
        </p>
      )}

      {/* Zone grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {zones.map((z) => (
          <ZoneCard
            key={z.id}
            deviceId={z.device_id}
            zoneId={z.zone_id}
            name={z.name}
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
            allZones={zones}
            allDevices={devices}
          />
        ))}
      </div>
    </div>
  );
}
