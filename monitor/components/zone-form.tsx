"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createZone, searchPlantSpecies, getPlantDetails } from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";
import { Plus, X, Search, Loader2 } from "lucide-react";

type PerenualSpecies = {
  id: number;
  commonName: string;
  scientificName: string;
  image: string | null;
  watering: string | null;
  sunlight: string[] | null;
};

type Plant = {
  species: string;
  variety: string;
  notes: string;
  count: number;
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
  plants?: string | null;
};

function SpeciesSearch({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (species: string, data: Partial<Plant>) => void;
}) {
  const [results, setResults] = useState<PerenualSpecies[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInput(value);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleChange(val: string) {
    setInput(val);
    clearTimeout(timer.current);
    if (val.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      const res = await searchPlantSpecies(val);
      setResults(res);
      setOpen(res.length > 0);
      setSearching(false);
    }, 300);
  }

  async function handlePick(s: PerenualSpecies) {
    setOpen(false);
    setInput(s.commonName);
    setSearching(true);
    const details = await getPlantDetails(s.id);
    setSearching(false);
    onSelect(s.commonName, {
      perenualId: s.id,
      scientificName: s.scientificName,
      defaultImage: details?.image || s.image || undefined,
      watering: details?.watering || s.watering || undefined,
      sunlight: details?.sunlight || s.sunlight || undefined,
      description: details?.description || undefined,
      careLevel: details?.careLevel || undefined,
    });
  }

  return (
    <div ref={containerRef} className="relative space-y-1">
      <Label>Species</Label>
      <div className="relative">
        <Input
          value={input}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="e.g. Tomato — search Perenual DB"
          className="pr-8"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg">
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handlePick(s)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
            >
              {s.image ? (
                <img
                  src={s.image}
                  alt=""
                  className="h-8 w-8 flex-shrink-0 rounded object-cover"
                />
              ) : (
                <div className="h-8 w-8 flex-shrink-0 rounded bg-muted" />
              )}
              <div className="min-w-0">
                <div className="truncate font-medium">{s.commonName}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {s.scientificName}
                  {s.watering && ` · ${s.watering}`}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ZoneForm({
  devices,
  nextZoneId,
  zone,
  onSuccess,
}: {
  devices: { id: string; name: string }[];
  nextZoneId?: number;
  zone?: ZoneData;
  onSuccess?: () => void;
}) {
  const [image, setImage] = useState<string | null>(zone?.image ?? null);
  const [plants, setPlants] = useState<Plant[]>(() => parsePlants(zone?.plants));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlants(parsePlants(zone?.plants));
  }, [zone?.plants]);

  function addPlant() {
    setPlants([...plants, { species: "", variety: "", notes: "", count: 1 }]);
  }

  function updatePlant(i: number, field: keyof Plant, value: string | number | undefined) {
    const next = [...plants];
    (next[i] as any)[field] = value;
    setPlants(next);
  }

  function removePlant(i: number) {
    setPlants(plants.filter((_, idx) => idx !== i));
  }

  function handleSpeciesSelect(i: number, species: string, data: Partial<Plant>) {
    const next = [...plants];
    next[i] = { ...next[i], species, ...data };
    setPlants(next);
  }

  const [, action] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      setError(null);
      try {
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
          plants: (formData.get("plants") as string) || undefined,
        });
        onSuccess?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    },
    null,
  );

  return (
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
        <Label htmlFor="name">Zone Name</Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g. Herb Bed"
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

      {/* Plants */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Plants in this spot</Label>
          <Button type="button" variant="outline" size="sm" onClick={addPlant}>
            <Plus className="mr-1 h-3 w-3" /> Add plant
          </Button>
        </div>
        {plants.map((p, i) => (
          <div
            key={i}
            className="relative rounded-lg border border-border p-3 pt-7"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removePlant(i)}
              className="absolute right-1 top-1 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              aria-label="Remove plant"
            >
              <X className="h-3 w-3" />
            </Button>

            {p.defaultImage && (
              <div className="mb-3 overflow-hidden rounded border border-border">
                <img
                  src={p.defaultImage}
                  alt={p.species}
                  className="h-24 w-full object-cover"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <SpeciesSearch
                  value={p.species}
                  onSelect={(species, data) => handleSpeciesSelect(i, species, data)}
                />
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label>Variety</Label>
                <Input
                  value={p.variety}
                  onChange={(e) => updatePlant(i, "variety", e.target.value)}
                  placeholder="e.g. Cherry"
                />
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label>Count</Label>
                <Input
                  type="number"
                  min={1}
                  value={p.count}
                  onChange={(e) => updatePlant(i, "count", parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Notes</Label>
                <Input
                  value={p.notes}
                  onChange={(e) => updatePlant(i, "notes", e.target.value)}
                  placeholder="e.g. Planted May 15"
                />
              </div>
            </div>

            {p.watering || p.sunlight ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.watering && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                    Water: {p.watering}
                  </span>
                )}
                {p.sunlight?.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
                {p.careLevel && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                    Care: {p.careLevel}
                  </span>
                )}
              </div>
            ) : null}
          </div>
        ))}
        {plants.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No plants added yet.
          </p>
        )}
      </div>

      <input type="hidden" name="plants" value={JSON.stringify(plants)} />

      {error && <p className="text-sm text-destructive">{error}</p>}
      <SubmitButton />
    </form>
  );
}
