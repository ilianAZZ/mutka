import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Separate from vite.config.ts on purpose: tests don't need the dev-server CSP
// headers, and we want a jsdom environment (localStorage, etc.) for the gateway
// permission tests. Run with `pnpm test` (CI) or `pnpm test:watch`.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
