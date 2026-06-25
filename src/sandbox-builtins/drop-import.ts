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
      if (!files.length) return;
      const temps: string[] = [];
      for (const file of files) {
        temps.push((await host.sys.writeTempFile(file.name, file.base64)) as string);
      }
      await host.fs.copyFiles(temps, dest);
      await host.refresh();
    });
  },
});
