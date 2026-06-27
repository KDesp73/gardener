"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createZone } from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save Zone"}
    </Button>
  );
}

type ZoneData = {
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
  image?: string | null;
};

export function ZoneFormDialog({
  devices,
  nextZoneId,
  zone,
  trigger,
}: {
  devices: { id: string; name: string }[];
  nextZoneId?: number;
  zone?: ZoneData;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<string | null>(zone?.image ?? null);

  const [, action] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      await createZone({
        deviceId: formData.get("deviceId") as string,
        zoneId: parseInt(formData.get("zoneId") as string),
        name: formData.get("name") as string,
        sensorType: (formData.get("sensorType") as "capacitive" | "resistive") || "capacitive",
        soilPin: parseInt(formData.get("soilPin") as string) || 0,
        relayPin: parseInt(formData.get("relayPin") as string) || 0,
        dryThreshold: parseInt(formData.get("dryThreshold") as string) || 1500,
        wetThreshold: parseInt(formData.get("wetThreshold") as string) || 3000,
        maxRunSec: parseInt(formData.get("maxRunSec") as string) || 60,
        scheduleOn: parseInt(formData.get("scheduleOn") as string) || 420,
        scheduleOff: parseInt(formData.get("scheduleOff") as string) || 480,
        image: (formData.get("image") as string) || undefined,
      });
      setOpen(false);
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : (
        <DialogTrigger render={<Button>Add Plant</Button>} />
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{zone ? `Edit ${zone.name}` : "Add Plant Zone"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deviceId">Device</Label>
            <Select
              name="deviceId"
              defaultValue={zone?.deviceId || devices[0]?.id}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {devices.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name || d.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <input
            type="hidden"
            name="zoneId"
            value={zone?.zoneId ?? nextZoneId ?? 0}
          />

          <div className="space-y-2">
            <Label htmlFor="name">Plant Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. Basil"
              defaultValue={zone?.name}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sensorType">Soil Sensor Type</Label>
            <Select
              name="sensorType"
              defaultValue={zone?.sensorType || "capacitive"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="capacitive">
                  Capacitive (dry=low, wet=high)
                </SelectItem>
                <SelectItem value="resistive">
                  Resistive (dry=high, wet=low)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="soilPin">Soil Sensor Pin</Label>
              <Input
                id="soilPin"
                name="soilPin"
                type="number"
                defaultValue={zone?.soilPin ?? 34}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relayPin">Relay Pin</Label>
              <Input
                id="relayPin"
                name="relayPin"
                type="number"
                defaultValue={zone?.relayPin ?? 12}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dryThreshold">Dry Threshold</Label>
              <Input
                id="dryThreshold"
                name="dryThreshold"
                type="number"
                defaultValue={zone?.dryThreshold ?? 1500}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wetThreshold">Wet Threshold</Label>
              <Input
                id="wetThreshold"
                name="wetThreshold"
                type="number"
                defaultValue={zone?.wetThreshold ?? 3000}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maxRunSec">Max Run (s)</Label>
              <Input
                id="maxRunSec"
                name="maxRunSec"
                type="number"
                defaultValue={zone?.maxRunSec ?? 60}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduleOn">Schedule Start (min)</Label>
              <Input
                id="scheduleOn"
                name="scheduleOn"
                type="number"
                defaultValue={zone?.scheduleOn ?? 420}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduleOff">Schedule End (min)</Label>
            <Input
              id="scheduleOff"
              name="scheduleOff"
              type="number"
              defaultValue={zone?.scheduleOff ?? 480}
            />
          </div>

          <input type="hidden" name="image" value={image ?? ""} />
          <ImagePicker value={image} onChange={setImage} />

          <SubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}
