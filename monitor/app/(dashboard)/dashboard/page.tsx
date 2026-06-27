import { getAllZones, getDevices } from "@/app/actions";
import { DashboardClient } from "@/components/dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [devices, zones] = await Promise.all([getDevices(), getAllZones()]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Gardener</h1>
      <DashboardClient zones={zones} devices={devices} />
    </div>
  );
}
