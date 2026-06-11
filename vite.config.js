import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build the front-end (in /web) into /dist at the project root.
// The Express server serves /dist in production.
export default defineConfig({
  root: "web",
  plugins: [react()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    // local dev only: proxy API calls to the node server on :3000
    proxy: {
      "/api": "http://localhost:3000",
      "/auth": "http://localhost:3000",
      "/webhooks": "http://localhost:3000",
    },
  },
});
