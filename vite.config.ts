import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    // In dev the page is served from this Vite origin, NOT Tauri's custom
    // protocol, so the `csp` in tauri.conf.json does not apply. Send the same
    // policy as `devCsp` here so the security model (esp. `connect-src` locking
    // network to the IPC bridge) is enforced during development too — otherwise a
    // module's stray `fetch` would silently go out in dev. Keep this in sync with
    // `app.security.devCsp` in src-tauri/tauri.conf.json. The extra `'unsafe-*'`
    // and ws/localhost sources are what Vite's HMR + React Fast Refresh need.
    headers: {
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self' data: blob: https: asset: http://asset.localhost; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; connect-src 'self' ipc: http://ipc.localhost ws://localhost:1420 http://localhost:1420; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-src 'none'",
    },
  },
}));
