import type { ModulePermission } from "../core/module-registry/module-registry.types";

// =============================================================================
// PERMISSION INFO — human labels + danger classification for the install
// consent screen. A community module runs untrusted code; before enabling one
// the user sees exactly what it asked for, with sensitive permissions flagged.
// Keep this in sync with ModulePermission in module-registry.types.ts.
// =============================================================================

export interface PermissionInfo {
  label: string;
  /** One-line, user-facing description of what granting it allows. */
  description: string;
  /** Sensitive permissions get an explicit warning before the user accepts. */
  dangerous: boolean;
}

export const PERMISSION_INFO: Record<ModulePermission, PermissionInfo> = {
  "fs:read": {
    label: "Read files",
    description: "List folders and read file contents.",
    dangerous: false,
  },
  "fs:write": {
    label: "Modify files",
    description: "Create, move, rename, and DELETE files and folders.",
    dangerous: true,
  },
  "fs:temp": {
    label: "Write temp files",
    description: "Write short-lived files to the system temp folder.",
    dangerous: false,
  },
  "clipboard:read": {
    label: "Read clipboard",
    description: "Read files currently on the clipboard.",
    dangerous: false,
  },
  "clipboard:write": {
    label: "Write clipboard",
    description: "Replace the contents of your clipboard.",
    dangerous: true,
  },
  navigation: {
    label: "Navigate",
    description: "Change the current folder and open tabs.",
    dangerous: false,
  },
  view: {
    label: "View state",
    description: "Control selection, sorting, and filters.",
    dangerous: false,
  },
  dialog: {
    label: "Show dialogs",
    description: "Show prompts and confirmation dialogs.",
    dangerous: false,
  },
  "network:public": {
    label: "Internet access (HTTPS)",
    description: "Make outbound HTTPS requests to public websites (can send data off your machine). HTTPS is enforced, so traffic can't be read in transit.",
    dangerous: true,
  },
  "network:local": {
    label: "Local network access",
    description: "Make requests to IP addresses or localhost (your machine and local network — e.g. a self-hosted server or NAS).",
    dangerous: true,
  },
  storage: {
    label: "Storage",
    description: "Persist its own configuration.",
    dangerous: false,
  },
  secrets: {
    label: "Keychain secrets",
    description: "Read and write credentials in the macOS Keychain.",
    dangerous: true,
  },
  ui: {
    label: "Custom UI",
    description: "Render panels, status-bar items, and settings sections.",
    dangerous: false,
  },
  discovery: {
    label: "Module discovery",
    description: "Contribute a source that finds and fetches other installable modules.",
    dangerous: true,
  },
  shell: {
    label: "Run commands",
    description: "Execute shell or system commands.",
    dangerous: true,
  },
};

/** Info for a permission, falling back to a generic entry for unknown strings. */
export function permissionInfo(permission: string): PermissionInfo {
  return (
    PERMISSION_INFO[permission as ModulePermission] ?? {
      label: permission,
      description: "Unknown permission.",
      dangerous: true,
    }
  );
}

/** The dangerous subset of a permission list (for an at-a-glance warning). */
export function dangerousPermissions(permissions: readonly string[]): string[] {
  return permissions.filter((p) => permissionInfo(p).dangerous);
}
