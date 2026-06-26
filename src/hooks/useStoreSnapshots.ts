import { useEffect, useState } from "react";
import { EventBus } from "../core/event-bus/EventBus";
import { Events } from "../core/event-bus/events";
import { SelectionStore } from "../core/stores/SelectionStore";
import { ClipboardStore } from "../core/stores/ClipboardStore";
import { ListingStore } from "../core/stores/ListingStore";
import { HomeStore } from "../core/stores/HomeStore";
import { SettingsStore } from "../core/stores/SettingsStore";
import { ModulesStore } from "../core/stores/ModulesStore";
import type { FileItem, ClipboardState } from "../core/types";
import type { ListingSnapshot } from "../core/stores/listing.types";

export interface StoreSnapshots {
  homeDir: string;
  showSettings: boolean;
  showModules: boolean;
  selected: FileItem[];
  clipboard: ClipboardState;
  listing: ListingSnapshot;
}

/**
 * Bridges the framework-agnostic stores into React render state. Each store
 * owns its data; this hook only mirrors the latest snapshot for rendering.
 */
export function useStoreSnapshots(): StoreSnapshots {
  const [homeDir, setHomeDir] = useState<string>(HomeStore.homeDir);
  const [showSettings, setShowSettings] = useState<boolean>(SettingsStore.open);
  const [showModules, setShowModules] = useState<boolean>(ModulesStore.open);
  const [selected, setSelected] = useState<FileItem[]>(SelectionStore.items);
  const [clipboard, setClipboard] = useState<ClipboardState>(ClipboardStore.state);
  const [listing, setListing] = useState<ListingSnapshot>(
    () => ({ items: ListingStore.items, sort: ListingStore.sort })
  );

  useEffect(() => EventBus.on(Events.Home.changed, ({ homeDir }) => setHomeDir(homeDir)), []);
  useEffect(() => EventBus.on(Events.Settings.changed, ({ open }) => setShowSettings(open)), []);
  useEffect(() => EventBus.on(Events.ModulesUi.changed, ({ open }) => setShowModules(open)), []);
  useEffect(() => EventBus.on(Events.Selection.changed, ({ items }) => setSelected(items)), []);
  useEffect(() => EventBus.on(Events.Clipboard.changed, (state) => setClipboard(state)), []);
  useEffect(() => EventBus.on(Events.Listing.changed, (snap) => setListing(snap)), []);

  return { homeDir, showSettings, showModules, selected, clipboard, listing };
}
