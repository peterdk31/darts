import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // New versions install in the background and take over on next launch,
      // so a reload never interrupts a game in progress.
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      manifest: {
        // Stable app identity, so Chrome doesn't derive it from start_url.
        id: "/darts/?app=dart-game-tracker",
        name: "Dart Game Tracker",
        short_name: "Darts",
        description: "Score X01, Cricket, Killer and more at the dartboard — works offline.",
        theme_color: "#2563eb",
        background_color: "#0b0f17",
        display: "standalone",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  base: "/darts/",
});
