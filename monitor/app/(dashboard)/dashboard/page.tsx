import { getZones, getDevices } from "@/app/actions";
import { DashboardClient } from "@/components/dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const devices = await getDevices();
  const deviceId =
    devices.length > 0 ? (devices[0] as unknown as { id: string }).id : "";
  const zones = deviceId ? await getZones(deviceId) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Gardener</h1>
      <DashboardClient
        zones={zones as unknown as any[]}
        devices={devices as unknown as any[]}
      />
    </div>
  );
}
