"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ZoneForm } from "@/components/zone-form";

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
  plants?: string | null;
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
        <ZoneForm
          devices={devices}
          nextZoneId={nextZoneId}
          zone={zone}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
