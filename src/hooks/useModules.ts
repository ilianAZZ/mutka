import { useSyncExternalStore } from "react";
import { ModuleManager } from "../module-manager/ModuleManager";
import type { ManagedModule } from "../module-manager/types";

/**
 * Subscribe a component to the ModuleManager's tracked modules. Re-renders on any
 * lifecycle change (enable / disable / install / delete). The snapshot is cached
 * so useSyncExternalStore doesn't loop — ModuleManager rebuilds it on emit.
 */
let cache: ManagedModule[] = ModuleManager.getAll();
let cacheDirty = true;

function getSnapshot(): ManagedModule[] {
  if (cacheDirty) {
    cache = ModuleManager.getAll();
    cacheDirty = false;
  }
  return cache;
}

function subscribe(onChange: () => void): () => void {
  return ModuleManager.subscribe(() => {
    cacheDirty = true;
    onChange();
  });
}

export function useModules(): ManagedModule[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}
