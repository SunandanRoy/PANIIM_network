import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";

const r = (p: string) => path.resolve(__dirname, p);

// Dev harness standing in for the Lovable host (DECISIONS E-01). Aliases mirror a host after install:
// @/features/network -> module, @/network.routes -> integration binding, @/network.adapter -> harness adapter.
export default defineConfig({
  root: r("."),
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@/network.adapter", replacement: r("src/network.adapter.ts") },
      { find: "@/network.routes", replacement: r("../integration/vite-react-router/src/network.routes.tsx") },
      { find: /^@\//, replacement: r("../src") + "/" },
    ],
  },
  css: { postcss: { plugins: [tailwind({ config: r("tailwind.config.js") }), autoprefixer()] } },
  server: { port: 5173, host: "127.0.0.1" },
  preview: { port: 4173, host: "127.0.0.1" },
  build: {
    outDir: r("../dist-web"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(d3-|internmap)/.test(id) || /features\/network\/graph\//.test(id)) return "net-graph";
        },
      },
    },
  },
});
