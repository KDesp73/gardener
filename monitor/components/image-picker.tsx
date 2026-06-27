"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_DIM = 800;
const JPEG_QUALITY = 0.8;

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height / width) * MAX_DIM);
          width = MAX_DIM;
        } else {
          width = Math.round((width / height) * MAX_DIM);
          height = MAX_DIM;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function ImagePicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value ?? null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await resizeImage(file);
      setPreview(dataUrl);
      onChange(dataUrl);
    } catch (err) {
      console.warn("Image resize failed", err);
    }
  }

  function handleRemove() {
    setPreview(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <Label>Photo</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      {preview ? (
        <div className="relative overflow-hidden rounded-lg border border-border">
          <img
            src={preview}
            alt="Plant preview"
            className="h-40 w-full object-cover"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="absolute right-1 top-1 h-7 w-7 rounded-full bg-background/80 p-0 hover:bg-background"
            aria-label="Remove photo"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <ImagePlus className="h-8 w-8" />
          Tap to add photo
        </button>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
      {children}
    </label>
  );
}
