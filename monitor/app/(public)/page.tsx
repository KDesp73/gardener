import { getAllZones } from "@/app/actions";
import { GardenDisplay } from "@/components/garden-display";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const zones = await getAllZones();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <GardenDisplay zones={zones} />
    </div>
  );
}
