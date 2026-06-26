import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gardener",
    short_name: "Gardener",
    description: "ESP32 automated watering system monitor",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5dc",
    theme_color: "#16a34a",
    orientation: "any",
    categories: ["utilities", "lifestyle"],
    icons: [
      { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { src: "/icon.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
  };
}
