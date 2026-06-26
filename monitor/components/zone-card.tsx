"use client";

import { useActionState, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { deleteZone, toggleZone, waterZone } from "@/app/actions";
import { ReadingsChart } from "@/components/readings-chart";
import { ZoneFormDialog } from "@/components/zone-form-dialog";

const STALE_AFTER_MS = 30_000;

type TimedValue = { value: number; ts: number };
type ReadingMap = Record<string, TimedValue>;

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function MoistureBar({
  value,
  dry,
  wet,
}: {
  value: number;
  dry: number;
  wet: number;
}) {
  const range = wet - dry;
  const pct = range > 0 ? ((value - dry) / range) * 100 : 50;
  const clamped = Math.max(0, Math.min(100, pct));

  let color = "bg-amber-500";
  if (value <= dry) color = "bg-red-500";
  else if (value >= wet) color = "bg-blue-500";

  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`absolute inset-y-0 left-0 rounded-full transition-all ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

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

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export function ZoneCard({
  deviceId,
  zoneId,
  name,
  sensorType,
  soilPin,
  relayPin,
  dryThreshold,
  wetThreshold,
  maxRunSec,
  scheduleOn,
  scheduleOff,
  enabled,
  readings,
  allZones,
  allDevices,
  readOnly,
}: {
  deviceId: string;
  zoneId: number;
  name: string;
  sensorType: string;
  soilPin: number;
  relayPin: number;
  dryThreshold: number;
  wetThreshold: number;
  maxRunSec: number;
  scheduleOn: number;
  scheduleOff: number;
  enabled: boolean;
  readings: ReadingMap;
  allZones?: { id: number; device_id: string; zone_id: number; name: string }[];
  allDevices?: { id: string; name: string }[];
  readOnly?: boolean;
}) {
  const [showConfig, setShowConfig] = useState(false);
  const [showChart, setShowChart] = useState(false);

  const [deleteState, deleteAction, deletePending] = useActionState(
    () => deleteZone(deviceId, zoneId),
    null,
  );

  const moistureVal = readings[`${deviceId}:${zoneId}:moisture`];
  const waterState = readings[`${deviceId}:${zoneId}:water`];
  const temp = readings[`${deviceId}:env:temp`];
  const hum = readings[`${deviceId}:env:hum`];

  const moisture = moistureVal?.value;
  const moistureTs = moistureVal?.ts;
  const stale = moistureTs && Date.now() - moistureTs > STALE_AFTER_MS;

  let status: "dry" | "wet" | "ok" | "unknown" = "unknown";
  if (moisture !== undefined && !stale) {
    if (isDry(moisture, dryThreshold, wetThreshold, sensorType)) status = "dry";
    else if (isWet(moisture, dryThreshold, wetThreshold, sensorType)) status = "wet";
    else status = "ok";
  }

  const statusBadge = {
    dry: { label: "Needs water", variant: "destructive" as const },
    wet: { label: "Wet", variant: "default" as const },
    ok: { label: "OK", variant: "secondary" as const },
    unknown: { label: "—", variant: "outline" as const },
  }[status];

  return (
    <Card className={enabled ? "" : "opacity-50"}>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg">{name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            {waterState?.value === 1 && <Badge variant="default">Watering</Badge>}
            {stale && <Badge variant="outline">old data</Badge>}
            <span className="text-xs text-muted-foreground">Z{zoneId}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!readOnly && allZones && allDevices && (
            <ZoneFormDialog
              devices={allDevices}
              zone={{
                deviceId,
                zoneId,
                name,
                sensorType,
                soilPin,
                relayPin,
                dryThreshold,
                wetThreshold,
                maxRunSec,
                scheduleOn,
                scheduleOff,
              }}
              trigger={<Button variant="ghost" size="sm">Edit</Button>}
            />
          )}
          {!readOnly && (
            <Switch
              size="sm"
              defaultChecked={enabled}
              onCheckedChange={(checked) => toggleZone(deviceId, zoneId, checked)}
            />
          )}
          {!readOnly && (
            <form action={deleteAction}>
              <Button
                variant="ghost"
                size="sm"
                disabled={deletePending}
                className="text-muted-foreground hover:text-destructive"
              >
                {deletePending ? "..." : "✕"}
              </Button>
            </form>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Moisture */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Moisture</span>
            <span className="flex items-center gap-2 font-mono tabular-nums">
              {moisture !== undefined ? moisture : "—"}
              {moistureTs && (
                <span className="text-[10px] text-muted-foreground">
                  {timeAgo(moistureTs)}
                </span>
              )}
            </span>
          </div>
          {moisture !== undefined && (
            <MoistureBar
              value={moisture}
              dry={dryThreshold}
              wet={wetThreshold}
            />
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg bg-muted/50 p-2">
            <div className="text-xs text-muted-foreground">Temp</div>
            <div className="font-mono tabular-nums">
              {temp !== undefined ? `${temp.value.toFixed(1)}°` : "—"}
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <div className="text-xs text-muted-foreground">Humidity</div>
            <div className="font-mono tabular-nums">
              {hum !== undefined ? `${hum.value.toFixed(0)}%` : "—"}
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <div className="text-xs text-muted-foreground">Schedule</div>
            <div className="font-mono tabular-nums">
              {formatTime(scheduleOn)}–{formatTime(scheduleOff)}
            </div>
          </div>
        </div>

        {!readOnly && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => waterZone(deviceId, zoneId, maxRunSec)}
          >
            Water now ({maxRunSec}s)
          </Button>
        )}

        {/* Chart toggle */}
        {showChart && (
          <ReadingsChart
            deviceId={deviceId}
            zoneId={zoneId}
            sensorType="moisture"
          />
        )}

        {/* Bottom row: chart toggle + config toggle */}
        <div className="flex gap-3 text-xs">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setShowChart(!showChart)}
          >
            {showChart ? "Hide" : "Show"} history
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setShowConfig(!showConfig)}
          >
            {showConfig ? "Hide" : "Show"} config
          </button>
        </div>

        {showConfig && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Sensor type</span>
            <span className="text-right font-mono capitalize">{sensorType}</span>
            <span>Soil pin</span>
            <span className="font-mono text-right">{soilPin}</span>
            <span>Relay pin</span>
            <span className="font-mono text-right">{relayPin}</span>
            <span>Dry threshold</span>
            <span className="font-mono text-right">{dryThreshold}</span>
            <span>Wet threshold</span>
            <span className="font-mono text-right">{wetThreshold}</span>
            <span>Max run</span>
            <span className="font-mono text-right">{maxRunSec}s</span>
            <span>Schedule</span>
            <span className="font-mono text-right">
              {formatTime(scheduleOn)}–{formatTime(scheduleOff)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
