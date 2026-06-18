import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  build: {
    // The offline demo intentionally bundles the generated public scenario corpus.
    chunkSizeWarningLimit: 1600
  },
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
