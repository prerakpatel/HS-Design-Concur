import type { MetadataRoute } from "next";

/** Installable as a home-screen app. Push notifications are a separate piece of work (service worker + Web Push). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Design & Concur",
    short_name: "Design & Concur",
    description: "Event asset request, review and approval for Harisumiran and Atmiya Care Charities.",
    start_url: "/events",
    display: "standalone",
    background_color: "#f9f6e2",
    theme_color: "#ffffff",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
