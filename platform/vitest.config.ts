import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["@testing-library/jest-dom"],
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/"],
      exclude: [
        "src/__tests__/**",
        "src/__e2e__/**",
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
      ],
    },
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
