import { useEffect, useRef } from "react";
import { AppBridge } from "../core/app-bridge/AppBridge";
import { ModuleRegistry } from "../core/module-registry/ModuleRegistry";
import { EventBus } from "../core/event-bus/EventBus";
import { Events } from "../core/event-bus/events";
import { handleCliArgs, listenForForwardedArgs } from "../core/cli/CliHandler";
import type { NavigationAPI, DialogAPI } from "../core/types";

export interface AppServices {
  getDirectory: () => string;
  getNavigation: () => NavigationAPI;
  refresh: () => void;
  dialog: DialogAPI;
}

/**
 * Connects App's React-owned privileged operations (navigation, dialog, refresh)
 * to the AppBridge once, then inits the registry and fires `app:ready` after the
 * modules finish loading. A ref keeps the provider returning the latest services
 * without re-registering on every render.
 */
export function useAppBridge(services: AppServices, modulesReady: Promise<unknown>): void {
  const servicesRef = useRef(services);
  servicesRef.current = services;

  useEffect(() => {
    AppBridge.connect({
      getDirectory: () => servicesRef.current.getDirectory(),
      getNavigation: () => servicesRef.current.getNavigation(),
      getRefresh: () => servicesRef.current.refresh,
      getDialog: () => servicesRef.current.dialog,
    });
    ModuleRegistry.init();
    listenForForwardedArgs();
    // Fire the launch hook once modules are registered AND AppBridge is connected,
    // so `core.home` can resolve the home dir and run the initial navigation.
    modulesReady.then(() => {
      EventBus.emit(Events.App.ready);
      handleCliArgs();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
