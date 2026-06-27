"use server";

import { getDb } from "@/lib/db";
import { publishConfig, publishCommand } from "@/lib/mqtt-server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export interface DeviceRow {
  id: string;
  name: string;
  mqtt_host: string;
  last_seen: string | null;
  created_at: string;
}

export interface ZoneRow {
  id: number;
  device_id: string;
  zone_id: number;
  name: string;
  soil_pin: number;
  relay_pin: number;
  dry_threshold: number;
  wet_threshold: number;
  max_run_sec: number;
  schedule_on: number;
  schedule_off: number;
  sensor_type: string;
  enabled: number;
  image: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReadingRow {
  id: number;
  device_id: string;
  zone_id: number | null;
  sensor_type: string;
  value: number;
  unit: string;
  updated_at: string;
}

const zoneSchema = z.object({
  deviceId: z.string().min(1),
  zoneId: z.coerce.number().int().min(0),
  name: z.string().min(1).max(32),
  soilPin: z.coerce.number().int().default(0),
  relayPin: z.coerce.number().int().default(0),
  dryThreshold: z.coerce.number().int().default(1500),
  wetThreshold: z.coerce.number().int().default(3000),
  maxRunSec: z.coerce.number().int().default(60),
  scheduleOn: z.coerce.number().int().default(420),
  scheduleOff: z.coerce.number().int().default(480),
  sensorType: z.enum(["capacitive", "resistive"]).default("capacitive"),
  image: z.string().optional(),
});

export type ZoneFormData = z.infer<typeof zoneSchema>;

export async function discoverDevice(deviceId: string, name?: string) {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO devices (id, name, last_seen)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT (id) DO UPDATE SET
          name = COALESCE(NULLIF(?, ''), devices.name),
          last_seen = datetime('now')`,
    args: [deviceId, name || deviceId, name || deviceId],
  });
  revalidatePath("/dashboard");
}

function serialize<T>(rows: unknown[]): T[] {
  return rows.map((r) => Object.assign({}, r)) as T[];
}

export async function getDevices() {
  const db = getDb();
  const result = await db.execute("SELECT * FROM devices ORDER BY name");
  return serialize<DeviceRow>(result.rows);
}

export async function getZones(deviceId: string) {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM zones WHERE device_id = ? ORDER BY zone_id",
    args: [deviceId],
  });
  return serialize<ZoneRow>(result.rows);
}

export async function getAllZones() {
  const db = getDb();
  const result = await db.execute(
    "SELECT * FROM zones ORDER BY zone_id",
  );
  return serialize<ZoneRow>(result.rows);
}

export async function getLatestReadings(deviceId: string) {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM latest_readings WHERE device_id = ?",
    args: [deviceId],
  });
  return serialize<ReadingRow>(result.rows);
}

export async function upsertDevice(deviceId: string, name: string) {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO devices (id, name) VALUES (?, ?)
          ON CONFLICT (id) DO UPDATE SET name = excluded.name`,
    args: [deviceId, name],
  });
  revalidatePath("/dashboard");
}

export async function createZone(data: ZoneFormData) {
  const db = getDb();

  await db.execute({
    sql: `INSERT INTO zones (device_id, zone_id, name, soil_pin, relay_pin,
          dry_threshold, wet_threshold, max_run_sec, schedule_on, schedule_off, sensor_type, image)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (device_id, zone_id) DO UPDATE SET
          name = excluded.name, soil_pin = excluded.soil_pin,
          relay_pin = excluded.relay_pin,
          dry_threshold = excluded.dry_threshold,
          wet_threshold = excluded.wet_threshold,
          max_run_sec = excluded.max_run_sec,
          schedule_on = excluded.schedule_on,
          schedule_off = excluded.schedule_off,
          sensor_type = excluded.sensor_type,
          image = excluded.image,
          updated_at = datetime('now')`,
    args: [
      data.deviceId,
      data.zoneId,
      data.name,
      data.soilPin,
      data.relayPin,
      data.dryThreshold,
      data.wetThreshold,
      data.maxRunSec,
      data.scheduleOn,
      data.scheduleOff,
      data.sensorType,
      data.image || null,
    ],
  });

  await upsertDevice(data.deviceId, data.deviceId);

  try {
    await publishConfig(data.deviceId, data.zoneId, {
      name: data.name,
      soil_pin: data.soilPin,
      relay_pin: data.relayPin,
      dry: data.dryThreshold,
      wet: data.wetThreshold,
      max_run: data.maxRunSec,
      schedule_on: data.scheduleOn,
      schedule_off: data.scheduleOff,
      sensor_type: data.sensorType,
      enabled: true,
    });
  } catch (e) {
    console.warn("MQTT publish failed:", e);
  }

  revalidatePath("/dashboard");
}

export async function deleteZone(deviceId: string, zoneId: number) {
  const db = getDb();

  await db.execute({
    sql: "DELETE FROM zones WHERE device_id = ? AND zone_id = ?",
    args: [deviceId, zoneId],
  });

  await db.execute({
    sql: `DELETE FROM latest_readings WHERE device_id = ? AND zone_id = ?`,
    args: [deviceId, zoneId],
  });

  try {
    await publishConfig(deviceId, zoneId, { enabled: false });
  } catch (e) {
    console.warn("MQTT publish failed:", e);
  }

  revalidatePath("/dashboard");
}

export async function getReadings(
  deviceId: string,
  zoneId: number | null,
  sensorType: string,
  limit = 60,
) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT value, created_at FROM readings
          WHERE device_id = ? AND COALESCE(zone_id, -1) = COALESCE(?, -1) AND sensor_type = ?
          ORDER BY created_at DESC LIMIT ?`,
    args: [deviceId, zoneId, sensorType, limit],
  });
  return result.rows.reverse();
}

export async function toggleZone(deviceId: string, zoneId: number, enabled: boolean) {
  const db = getDb();
  await db.execute({
    sql: "UPDATE zones SET enabled = ?, updated_at = datetime('now') WHERE device_id = ? AND zone_id = ?",
    args: [enabled ? 1 : 0, deviceId, zoneId],
  });

  try {
    await publishConfig(deviceId, zoneId, { enabled });
  } catch (e) {
    console.warn("MQTT publish failed:", e);
  }

  revalidatePath("/dashboard");
}

export async function waterZone(deviceId: string, zoneId: number, seconds: number) {
  try {
    await publishCommand(deviceId, zoneId, "water", { state: "on", duration: seconds });
  } catch (e) {
    console.warn("MQTT publish failed:", e);
  }
}

export async function saveReading(
  deviceId: string,
  zoneId: number | null,
  sensorType: string,
  value: number,
  unit: string,
) {
  const db = getDb();

  await db.execute({
    sql: `INSERT INTO latest_readings (device_id, zone_id, sensor_type, value, unit, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT (device_id, COALESCE(zone_id, -1), sensor_type)
          DO UPDATE SET value = excluded.value, unit = excluded.unit,
          updated_at = excluded.updated_at`,
    args: [deviceId, zoneId, sensorType, value, unit],
  });

  await db.execute({
    sql: `INSERT INTO readings (device_id, zone_id, sensor_type, value, unit)
          VALUES (?, ?, ?, ?, ?)`,
    args: [deviceId, zoneId, sensorType, value, unit],
  });
}
