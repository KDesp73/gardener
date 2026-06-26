"use client";

import { useEffect, useState } from "react";
import { getReadings } from "@/app/actions";

type Reading = { value: number; created_at: string };

export function ReadingsChart({
  deviceId,
  zoneId,
  sensorType,
}: {
  deviceId: string;
  zoneId: number | null;
  sensorType: string;
}) {
  const [data, setData] = useState<Reading[]>([]);

  useEffect(() => {
    getReadings(deviceId, zoneId, sensorType).then((rows) => {
      setData(rows as unknown as Reading[]);
    });
  }, [deviceId, zoneId, sensorType]);

  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg bg-muted/30 text-xs text-muted-foreground">
        No history yet
      </div>
    );
  }

  const values = data.map((r) => r.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const w = 300;
  const h = 80;
  const pts = data.map(
    (r, i) =>
      `${(i / (data.length - 1)) * w},${h - ((r.value - min) / range) * (h - 4) - 2}`,
  );

  return (
    <div className="rounded-lg bg-muted/30 p-2">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-20 w-full"
        preserveAspectRatio="none"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-foreground/60"
          points={pts.join(" ")}
        />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{data.length} readings</span>
        <span>
          {min}–{max}
        </span>
      </div>
    </div>
  );
}
