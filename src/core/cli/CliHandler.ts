import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";
import { ModuleRegistry } from "../module-registry/ModuleRegistry";

interface CliArgs {
  path: string | null;
  picker: boolean;
  run: string | null;
  listActions: boolean;
}

/**
 * Handles CLI arguments after modules are ready.
 * Called once from useAppBridge after `app:ready`.
 */
export async function handleCliArgs(): Promise<void> {
  let args: CliArgs;
  try {
    args = await invoke<CliArgs>("get_cli_args");
  } catch {
    return;
  }

  if (args.listActions) {
    const actions = ModuleRegistry.getActions();
    const lines = actions.map((a) => `${a.id}  ${a.label}`);
    await invoke("cli_output", { text: lines.join("\n") });
    await invoke("cli_exit", { code: 0 });
    return;
  }

  if (args.picker) {
    EventBus.emit(Events.Cli.picker);
    return;
  }

  if (args.run) {
    await ModuleRegistry.executeAction(args.run);
    await invoke("cli_output", { text: `✓ ran ${args.run}` });
    await invoke("cli_exit", { code: 0 });
    return;
  }

  if (args.path) {
    EventBus.emit(Events.Cli.navigate, { path: args.path });
  }
}

/**
 * Listen for CLI args forwarded from a second instance (single-instance plugin).
 * The second instance's argv arrives as a string[] via the `cli:forwarded-args` event.
 */
export function listenForForwardedArgs(): void {
  listen<string[]>("cli:forwarded-args", (event) => {
    const argv = event.payload;
    // Simple parsing: look for known flags in the forwarded argv.
    const pickerIdx = argv.indexOf("--picker");
    const runIdx = argv.indexOf("--run");

    if (pickerIdx !== -1) {
      EventBus.emit(Events.Cli.picker);
      return;
    }

    if (runIdx !== -1 && argv[runIdx + 1]) {
      ModuleRegistry.executeAction(argv[runIdx + 1]);
      return;
    }

    // Positional path: first arg that doesn't start with `-`
    const path = argv.find((a) => !a.startsWith("-"));
    if (path) {
      EventBus.emit(Events.Cli.navigate, { path });
    }
  });
}

/**
 * Output a picker result to stdout and exit.
 */
export async function outputPickerResult(path: string | null): Promise<void> {
  if (path) {
    await invoke("cli_output", { text: path });
    await invoke("cli_exit", { code: 0 });
  } else {
    await invoke("cli_exit", { code: 1 });
  }
}
