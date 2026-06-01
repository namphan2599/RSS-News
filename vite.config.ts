import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["supabase/**", "node_modules/**", "dist/**"],
    setupFiles: "./src/test/setup.ts",
    globals: true
  }
});