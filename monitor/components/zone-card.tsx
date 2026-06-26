"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { deleteZone } from "@/app/actions";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";

type ReadingMap = Record<string, number>;

export function ZoneCard({
  deviceId,
  zoneId,
  name,
  dryThreshold,
  wetThreshold,
  enabled,
  readings,
}: {
  deviceId: string;
  zoneId: number;
  name: string;
  dryThreshold: number;
  wetThreshold: number;
  enabled: boolean;
  readings: ReadingMap;
}) {
  const [state, action, pending] = useActionState(
    () => deleteZone(deviceId, zoneId),
    null,
  );

  const moisture = readings[`${deviceId}:${zoneId}:moisture`];
  const waterState = readings[`${deviceId}:${zoneId}:water`];

  let status: "dry" | "wet" | "ok" | "unknown" = "unknown";
  if (moisture !== undefined) {
    if (moisture <= dryThreshold) status = "dry";
    else if (moisture >= wetThreshold) status = "wet";
    else status = "ok";
  }

  return (
    <Card className={enabled ? "" : "opacity-50"}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">{name}</CardTitle>
        <div className="flex items-center gap-2">
          {moisture !== undefined && (
            <Badge
              variant={
                status === "dry"
                  ? "destructive"
                  : status === "wet"
                    ? "default"
                    : "secondary"
              }
            >
              {status === "dry"
                ? "Needs water"
                : status === "wet"
                  ? "Wet"
                  : status === "ok"
                    ? "OK"
                    : "—"}
            </Badge>
          )}
          {waterState === 1 && <Badge variant="default">Watering</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Moisture:</span>{" "}
            {moisture !== undefined ? moisture : "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Dry threshold:</span>{" "}
            {dryThreshold}
          </div>
          <div>
            <span className="text-muted-foreground">Wet threshold:</span>{" "}
            {wetThreshold}
          </div>
        </div>
        <form action={action} className="mt-3">
          <Button variant="destructive" size="sm" disabled={pending}>
            {pending ? "Removing..." : "Remove"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
