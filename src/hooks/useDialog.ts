import { useMemo, useState } from "react";
import type { DialogAPI } from "../core/types";
import type { DialogState } from "../components/Dialog/Dialog";

export interface DialogControl {
  dialogAPI: DialogAPI;
  dialogState: DialogState | null;
  closeDialog: () => void;
}

/**
 * Owns the modal dialog state and exposes the promise-based DialogAPI handed to
 * modules through the AppBridge. Each call renders a <Dialog> and resolves when
 * the user responds.
 */
export function useDialog(): DialogControl {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);

  const dialogAPI = useMemo((): DialogAPI => ({
    prompt: (options) => new Promise<string | null>((resolve) => {
      setDialogState({ type: "prompt", options, resolve });
    }),
    confirm: (options) => new Promise<boolean>((resolve) => {
      setDialogState({ type: "confirm", options, resolve });
    }),
    choose: (options) => new Promise<string | null>((resolve) => {
      setDialogState({ type: "choose", options, resolve });
    }),
  }), []);

  return { dialogAPI, dialogState, closeDialog: () => setDialogState(null) };
}
