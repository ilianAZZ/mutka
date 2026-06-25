import { useEffect, useMemo, useState } from "react";
import { EventBus } from "../core/event-bus/EventBus";
import { Events } from "../core/event-bus/events";
import { ModuleRegistry } from "../core/module-registry/ModuleRegistry";
import type { MutkaSidebarPanel, SidebarItemGroup } from "../core/module-registry/module-registry.types";

export interface SidebarContributions {
  rightPanels: MutkaSidebarPanel[];
  sidebarItemGroups: SidebarItemGroup[];
}

/**
 * Tracks the sidebar panels and item groups contributed by modules, which may
 * load asynchronously. Refreshes when a module registers/unregisters or when a
 * module mutates its sidebar items.
 */
export function useSidebarContributions(): SidebarContributions {
  const [sidebarPanels, setSidebarPanels] = useState<MutkaSidebarPanel[]>(
    () => ModuleRegistry.getSidebarPanels()
  );
  const [sidebarItemGroups, setSidebarItemGroups] = useState<SidebarItemGroup[]>(
    () => ModuleRegistry.getSidebarItemGroups()
  );

  useEffect(() => {
    const refreshContributions = () => {
      setSidebarPanels(ModuleRegistry.getSidebarPanels());
      setSidebarItemGroups(ModuleRegistry.getSidebarItemGroups());
    };
    const unsubReg = EventBus.on(Events.Module.registered, refreshContributions);
    const unsubUnreg = EventBus.on(Events.Module.unregistered, refreshContributions);
    const unsubSidebar = EventBus.on(Events.Sidebar.changed, () =>
      setSidebarItemGroups(ModuleRegistry.getSidebarItemGroups())
    );
    return () => { unsubReg(); unsubUnreg(); unsubSidebar(); };
  }, []);

  const rightPanels = useMemo(
    () => sidebarPanels.filter((p) => p.side === "right"),
    [sidebarPanels]
  );

  return { rightPanels, sidebarItemGroups };
}
