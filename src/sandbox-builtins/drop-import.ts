import { defineModule } from "../core/sandbox/defineModule";

interface ExternalDrop {
  files: { name: string; base64: string }[];
  dest: string;
}

// Imports files dropped from outside the app (e.g. Finder) onto a folder. The UI
// can only read the dropped File objects to base64 (a DOM concern); the privileged
// part — writing temp files and copying them into the destination — is feature
// logic, so it lives here behind capabilities instead of an invoke() in App.
export default defineModule({
  id: "core.drop-import",
  name: "Drop Import",
  version: "1.0.0",
  description: "Imports files dropped from Finder into the current folder.",
  permissions: ["fs:temp", "fs:write", "fs:read"],
  setup(host) {
    host.events.on("file:external-drop", async (payload) => {
      const { files, dest } = payload as ExternalDrop;
      if (!files?.length) return;
      const temps: string[] = [];
      for (const file of files) {
        // Skip malformed entries and don't let one bad file abort the whole drop.
        if (typeof file?.name !== "string" || typeof file?.base64 !== "string") continue;
        try {
          temps.push((await host.sys.writeTempFile(file.name, file.base64)) as string);
        } catch (e) {
          host.log(`[drop-import] could not stage ${file?.name}:`, e);
        }
      }
      if (!temps.length) return;
      try {
        await host.fs.copyFiles(temps, dest);
      } finally {
        await host.refresh();
      }
    });
  },
});
