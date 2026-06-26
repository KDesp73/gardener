import { saveReading } from "@/app/actions";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { device_id, zone_id, sensor_type, value, unit } = body;

    if (!device_id || !sensor_type || value === undefined) {
      return Response.json(
        { error: "Missing required fields: device_id, sensor_type, value" },
        { status: 400 },
      );
    }

    await saveReading(
      device_id,
      zone_id ?? null,
      sensor_type,
      Number(value),
      unit || "",
    );

    return Response.json({ ok: true });
  } catch (e) {
    console.error("Webhook error:", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
