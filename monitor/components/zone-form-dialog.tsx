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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save Zone"}
    </Button>
  );
}

export function ZoneFormDialog({
  devices,
  nextZoneId,
}: {
  devices: { id: string; name: string }[];
  nextZoneId: number;
}) {
  const [open, setOpen] = useState(false);

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
      });
      setOpen(false);
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button>Add Plant</Button>}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add or Edit Plant Zone</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deviceId">Device</Label>
            <Select name="deviceId" defaultValue={devices[0]?.id}>
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

          <input type="hidden" name="zoneId" value={nextZoneId} />

          <div className="space-y-2">
            <Label htmlFor="name">Plant Name</Label>
            <Input id="name" name="name" placeholder="e.g. Basil" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sensorType">Soil Sensor Type</Label>
            <Select name="sensorType" defaultValue="capacitive">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="soilPin">Soil Sensor Pin</Label>
              <Input
                id="soilPin"
                name="soilPin"
                type="number"
                defaultValue={34}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relayPin">Relay Pin</Label>
              <Input
                id="relayPin"
                name="relayPin"
                type="number"
                defaultValue={12}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dryThreshold">Dry Threshold</Label>
              <Input
                id="dryThreshold"
                name="dryThreshold"
                type="number"
                defaultValue={1500}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wetThreshold">Wet Threshold</Label>
              <Input
                id="wetThreshold"
                name="wetThreshold"
                type="number"
                defaultValue={3000}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxRunSec">Max Run (s)</Label>
              <Input
                id="maxRunSec"
                name="maxRunSec"
                type="number"
                defaultValue={60}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduleOn">Schedule Start (min)</Label>
              <Input
                id="scheduleOn"
                name="scheduleOn"
                type="number"
                defaultValue={420}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduleOff">Schedule End (min)</Label>
            <Input
              id="scheduleOff"
              name="scheduleOff"
              type="number"
              defaultValue={480}
            />
          </div>

          <SubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}
