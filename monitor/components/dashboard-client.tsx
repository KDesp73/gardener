"use client";

import { useEffect, useState } from "react";
import {
  connectMqtt,
  disconnectMqtt,
  onSensorMessage,
  type SensorMessage,
} from "@/lib/mqtt-browser";
import { ZoneCard } from "@/components/zone-card";
import { ZoneFormDialog } from "@/components/zone-form-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

function DevicePanel({
  deviceId,
  readings,
}: {
  deviceId: string;
  readings: Record<string, number>;
}) {
  const rssi = readings[`${deviceId}:env:rssi`];
  const uptime = readings[`${deviceId}:env:uptime`];
  const temp = readings[`${deviceId}:env:temp`];

  const rssiBars =
    rssi !== undefined
      ? rssi >= -50
        ? 4
        : rssi >= -65
          ? 3
          : rssi >= -80
            ? 2
            : 1
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{deviceId}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm">
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

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Uptime</span>
            {uptime !== undefined ? (
              <span className="font-mono text-xs">
                {uptime >= 86400
                  ? `${(uptime / 86400).toFixed(0)}d`
                  : uptime >= 3600
                    ? `${(uptime / 3600).toFixed(0)}h`
                    : `${(uptime / 60).toFixed(0)}m`}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Temp</span>
            {temp !== undefined ? (
              <span className="font-mono text-xs">{temp.toFixed(1)}°C</span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardClient({
  zones,
  devices,
}: {
  zones: ZoneRow[];
  devices: DeviceRow[];
}) {
  const [readings, setReadings] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsub = onSensorMessage((msg: SensorMessage) => {
      const key =
        msg.zoneId !== null
          ? `${msg.deviceId}:${msg.zoneId}:${msg.sensorType}`
          : `${msg.deviceId}:env:${msg.sensorType}`;

      setReadings((prev) => ({ ...prev, [key]: msg.value }));
    });

    connectMqtt();

    return () => {
      unsub();
      disconnectMqtt();
    };
  }, []);

  const deviceIds = [...new Set(zones.map((z) => z.device_id))];

  const nextZoneId =
    zones.length > 0 ? Math.max(...zones.map((z) => z.zone_id)) + 1 : 0;

  return (
    <div className="space-y-6">
      {/* Device panels */}
      {deviceIds.map((did) => (
        <DevicePanel key={did} deviceId={did} readings={readings} />
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
          />
        ))}
      </div>
    </div>
  );
}
