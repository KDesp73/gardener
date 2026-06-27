"use client";

import { Sprout, Droplets, Sun } from "lucide-react";

type Plant = {
  species: string;
  variety?: string;
  notes?: string;
  count?: number;
  perenualId?: number;
  scientificName?: string;
  description?: string;
  defaultImage?: string;
  watering?: string;
  sunlight?: string[];
  careLevel?: string;
};

function parsePlants(json: string | null | undefined): Plant[] {
  if (!json) return [];
  try {
    const p = JSON.parse(json);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

const STALE_AFTER_MS = 30_000;

const statusConfig = {
  dry: { label: "Thirsty", color: "bg-amber-500", text: "text-amber-500", bg: "bg-amber-50", dot: "bg-amber-500" },
  wet: { label: "Watered", color: "bg-blue-500", text: "text-blue-500", bg: "bg-blue-50", dot: "bg-blue-500" },
  ok: { label: "Healthy", color: "bg-green-500", text: "text-green-500", bg: "bg-green-50", dot: "bg-green-500" },
  unknown: { label: "—", color: "bg-gray-300", text: "text-gray-400", bg: "bg-gray-50", dot: "bg-gray-300" },
};

export function PlantCard({
  name,
  image,
  plants: plantsJson,
  moisture,
  moistureTs,
  status,
  enabled,
}: {
  name: string;
  image?: string | null;
  plants?: string | null;
  moisture?: number;
  moistureTs?: number;
  status: "dry" | "wet" | "ok" | "unknown";
  enabled: boolean;
}) {
  const plants = parsePlants(plantsJson);
  const showImage = image || plants[0]?.defaultImage || null;
  const sc = statusConfig[status];
  const stale = moistureTs && Date.now() - moistureTs > STALE_AFTER_MS;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm transition-all hover:shadow-md ${!enabled ? "opacity-50 grayscale" : ""}`}
    >
      {/* Image section */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {showImage ? (
          <img
            src={showImage}
            alt={name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Sprout className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        {/* Status badge */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-sm">
          <span className={`h-2 w-2 rounded-full ${sc.dot}`} />
          {stale ? "Old data" : sc.label}
        </div>
        {/* Count badge */}
        {plants.length > 0 && (
          <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-sm">
            {plants.reduce((s, p) => s + (p.count ?? 1), 0)} plant
            {plants.reduce((s, p) => s + (p.count ?? 1), 0) !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="space-y-3 p-4">
        {/* Zone name */}
        <div>
          <h3 className="text-lg font-semibold leading-tight">{name}</h3>
          {plants.length > 0 && (
            <div className="mt-0.5 space-y-0.5">
              {plants.map((p, i) => (
                <div key={i} className="flex items-baseline gap-1.5">
                  <span className="text-sm text-muted-foreground">
                    {p.species}
                    {p.variety ? ` (${p.variety})` : ""}
                  </span>
                  {(p.count ?? 1) > 1 && (
                    <span className="text-xs text-muted-foreground/60">×{p.count}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Care tags */}
        {plants.some((p) => p.watering || p.sunlight) && (
          <div className="flex flex-wrap gap-1.5">
            {plants[0]?.watering && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600">
                <Droplets className="h-3 w-3" />
                {plants[0].watering}
              </span>
            )}
            {plants[0]?.sunlight?.slice(0, 2).map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600"
              >
                <Sun className="h-3 w-3" />
                {s}
              </span>
            ))}
            {plants[0]?.careLevel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-600">
                <Sprout className="h-3 w-3" />
                {plants[0].careLevel}
              </span>
            )}
          </div>
        )}

        {/* Soil moisture */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Soil moisture</span>
            <span>
              {moisture !== undefined ? moisture : "—"}
              {moistureTs && !stale && (
                <span className="ml-1.5 text-muted-foreground/60">{timeAgo(moistureTs)}</span>
              )}
            </span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
            {moisture !== undefined && !stale && (
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all ${sc.color}`}
                style={{ width: `${Math.min(100, (moisture / 4000) * 100)}%` }}
              />
            )}
          </div>
        </div>

        {/* Notes */}
        {plants.some((p) => p.notes) && (
          <div className="text-xs text-muted-foreground">
            {plants
              .filter((p) => p.notes)
              .map((p) => p.notes)
              .join(" · ")}
          </div>
        )}

        {/* Perenual links */}
        {plants.some((p) => p.perenualId) && (
          <div className="flex gap-3 pt-1 text-xs text-muted-foreground">
            {plants
              .filter((p) => p.perenualId)
              .slice(0, 2)
              .map((p) => (
                <a
                  key={p.perenualId}
                  href={`https://perenual.com/plant-species-database-search-finder/species/${p.perenualId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  {p.species} info ↗
                </a>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
