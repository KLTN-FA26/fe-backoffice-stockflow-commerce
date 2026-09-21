/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/domain/**",
        "src/lib/auth/**",
        "src/lib/format/**",
        "src/lib/validation/**",
        "src/features/**/selectors.*",
        "src/features/**/schemas.*",
        "src/features/**/lifecycle.*",
      ],
      thresholds: {
        "src/lib/domain": { statements: 90, branches: 90 },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
    },
  },
});
