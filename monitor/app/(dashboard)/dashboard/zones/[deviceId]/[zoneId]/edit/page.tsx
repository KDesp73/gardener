import { getZone, getDevices } from "@/app/actions";
import { ZoneForm } from "@/components/zone-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditZonePage({
  params,
}: {
  params: Promise<{ deviceId: string; zoneId: string }>;
}) {
  const { deviceId, zoneId } = await params;
  const zid = parseInt(zoneId);
  if (isNaN(zid)) notFound();

  const zone = await getZone(deviceId, zid);
  if (!zone) notFound();

  const devices = await getDevices();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <h1 className="mb-8 text-2xl font-bold tracking-tight">
        Edit {zone.name}
      </h1>

      <ZoneForm
        devices={devices.map((d) => ({ id: d.id, name: d.name }))}
        zone={{
          deviceId: zone.device_id,
          zoneId: zone.zone_id,
          name: zone.name,
          sensorType: zone.sensor_type,
          soilPin: zone.soil_pin,
          relayPin: zone.relay_pin,
          dryThreshold: zone.dry_threshold,
          wetThreshold: zone.wet_threshold,
          maxRunSec: zone.max_run_sec,
          scheduleOn: zone.schedule_on,
          scheduleOff: zone.schedule_off,
          image: zone.image,
          plants: zone.plants,
        }}
        onSuccess={undefined}
      />
    </div>
  );
}
