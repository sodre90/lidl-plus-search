import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The production build is written into the Go module's embed directory so the
// `lidlsearch web` command can serve it from a single self-contained binary.
// During `npm run dev`, /api calls are proxied to the running Go server.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../internal/web/assets",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
});
