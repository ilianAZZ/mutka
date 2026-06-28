import { useMemo, useState } from "react";
import type { DialogAPI, DialogPickFileOptions } from "../core/types";
import type { DialogState } from "../components/Dialog/Dialog";

/** A pending file-picker request: its options + the resolver (which clears itself). */
export interface PickerState {
  options: DialogPickFileOptions;
  resolve: (path: string | null) => void;
}

export interface DialogControl {
  dialogAPI: DialogAPI;
  dialogState: DialogState | null;
  closeDialog: () => void;
  pickerState: PickerState | null;
}

/**
 * Owns the modal dialog + file-picker state and exposes the promise-based DialogAPI
 * handed to modules through the AppBridge. Each call renders a <Dialog> (prompt/
 * confirm/choose) or a <FilePickerModal> (pickFile) and resolves when the user responds.
 */
export function useDialog(): DialogControl {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [pickerState, setPickerState] = useState<PickerState | null>(null);

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
    pickFile: (options = {}) => new Promise<string | null>((resolve) => {
      setPickerState({ options, resolve: (path) => { setPickerState(null); resolve(path); } });
    }),
  }), []);

  return { dialogAPI, dialogState, closeDialog: () => setDialogState(null), pickerState };
}
