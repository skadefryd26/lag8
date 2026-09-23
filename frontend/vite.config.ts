import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // PORT lar deg kjøre en ekstra kopi av appen (f.eks. PORT=3011) ved siden av en som allerede bruker 3001.
      "/api": `http://localhost:${process.env.PORT ?? 3001}`,
    },
  },
});
