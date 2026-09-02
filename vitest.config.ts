import path from "node:path"
import { defineConfig } from "vitest/config"

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@comps": path.resolve(__dirname, "components"),
      "@utils": path.resolve(__dirname, "utils"),
    },
  },
})
