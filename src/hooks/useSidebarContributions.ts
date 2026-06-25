import { createElement, useEffect, useMemo, useState } from "react";
import { EventBus } from "../core/event-bus/EventBus";
import { Events } from "../core/event-bus/events";
import { ModuleRegistry } from "../core/module-registry/ModuleRegistry";
import type { MutkaSidebarPanel, SidebarItemGroup } from "../core/module-registry/module-registry.types";
import { DeclarativePanel } from "../components/Declarative/DeclarativePanel";

export interface SidebarContributions {
  rightPanels: MutkaSidebarPanel[];
  sidebarItemGroups: SidebarItemGroup[];
}

/**
 * Native React panels plus declarative (UINode-backed) panels, presented as one
 * MutkaSidebarPanel list. A declarative panel's component is a thin wrapper that
 * renders <DeclarativePanel> for the module's surface — so a sandboxed module
 * contributes a real panel without shipping any React.
 */
function allPanels(): MutkaSidebarPanel[] {
  const native = ModuleRegistry.getSidebarPanels();
  const declarative: MutkaSidebarPanel[] = ModuleRegistry.getDeclarativePanels().map((c) => ({
    id: c.id,
    title: c.title,
    icon: c.icon,
    side: c.side ?? "right",
    defaultWidth: c.defaultWidth,
    component: () => createElement(DeclarativePanel, { moduleId: c.moduleId, surfaceId: c.id, emptyHint: c.title }),
  }));
  return [...native, ...declarative];
}

/**
 * Tracks the sidebar panels and item groups contributed by modules, which may
 * load asynchronously. Refreshes when a module registers/unregisters or when a
 * module mutates its sidebar items.
 */
export function useSidebarContributions(): SidebarContributions {
  const [sidebarPanels, setSidebarPanels] = useState<MutkaSidebarPanel[]>(allPanels);
  const [sidebarItemGroups, setSidebarItemGroups] = useState<SidebarItemGroup[]>(
    () => ModuleRegistry.getSidebarItemGroups()
  );

  useEffect(() => {
    const refreshContributions = () => {
      setSidebarPanels(allPanels());
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
