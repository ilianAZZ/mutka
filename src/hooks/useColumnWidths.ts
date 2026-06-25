import { useCallback, useEffect, useState } from "react";
import { ColumnWidthStore } from "../core/columns/ColumnWidthStore";
import { EventBus } from "../core/event-bus/EventBus";
import { Events } from "../core/event-bus/events";

export interface UseColumnWidthsResult {
  widths: Record<string, number>;
  setWidth: (id: string, width: number) => void;
}

/** Bridges the persisted ColumnWidthStore into React for the list view. */
export function useColumnWidths(): UseColumnWidthsResult {
  const [widths, setWidths] = useState<Record<string, number>>(ColumnWidthStore.getAll());

  useEffect(
    () => EventBus.on(Events.Columns.widthsChanged, () => setWidths(ColumnWidthStore.getAll())),
    []
  );

  const setWidth = useCallback((id: string, width: number) => ColumnWidthStore.set(id, width), []);
  return { widths, setWidth };
}
