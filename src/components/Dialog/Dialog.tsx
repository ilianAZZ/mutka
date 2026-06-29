import { useCallback, useEffect, useRef, useState } from "react";
import "./Dialog.css";
import type { DialogPromptOptions, DialogConfirmOptions, DialogChooseOptions } from "../../core/types";
import { safeImageSrc } from "../../module-manager/imageSrc";

interface PromptDialogState {
  type: "prompt";
  options: DialogPromptOptions;
  resolve: (value: string | null) => void;
}

interface ConfirmDialogState {
  type: "confirm";
  options: DialogConfirmOptions;
  resolve: (value: boolean) => void;
}

interface ChooseDialogState {
  type: "choose";
  options: DialogChooseOptions;
  resolve: (value: string | null) => void;
}

export type DialogState = PromptDialogState | ConfirmDialogState | ChooseDialogState;

interface Props {
  state: DialogState;
  onClose: () => void;
}

export function Dialog({ state, onClose }: Props) {
  const [inputValue, setInputValue] = useState(
    state.type === "prompt" ? (state.options.defaultValue ?? "") : ""
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.type === "prompt") {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [state.type]);

  const confirm = useCallback(() => {
    if (state.type === "prompt") {
      state.resolve(inputValue.trim() || null);
    } else if (state.type === "confirm") {
      state.resolve(true);
    }
    // A "choose" dialog has no single confirm button; rows resolve themselves.
    onClose();
  }, [state, inputValue, onClose]);

  const cancel = useCallback(() => {
    if (state.type === "confirm") {
      state.resolve(false);
    } else {
      // prompt + choose both resolve with null on cancel.
      state.resolve(null);
    }
    onClose();
  }, [state, onClose]);

  const choose = useCallback((value: string) => {
    if (state.type === "choose") state.resolve(value);
    onClose();
  }, [state, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); cancel(); }
      if (e.key === "Enter" && state.type === "confirm") { e.preventDefault(); confirm(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [cancel, confirm, state.type]);

  const isDestructive = state.type === "confirm" && state.options.destructive;
  const confirmLabel = isDestructive ? "Delete" : "OK";
  const confirmClass = `dialog-btn ${isDestructive ? "dialog-btn-destructive" : "dialog-btn-confirm"}`;

  return (
    <div className="dialog-overlay" onClick={cancel}>
      <div className="dialog-panel" onClick={(e) => e.stopPropagation()}>
        <p className="dialog-message">{state.options.message}</p>
        {state.type === "confirm" && state.options.detail && (
          <p className="dialog-detail">{state.options.detail}</p>
        )}
        {state.type === "prompt" && (
          <input
            ref={inputRef}
            className="dialog-input"
            type="text"
            value={inputValue}
            placeholder={state.options.placeholder}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirm(); } }}
          />
        )}
        {state.type === "choose" && (
          <ul className="dialog-choices">
            {state.options.options.map((opt) => (
              <li key={opt.value}>
                <button className="dialog-choice" onClick={() => choose(opt.value)}>
                  {safeImageSrc(opt.icon) && (
                    <img className="dialog-choice-icon" src={safeImageSrc(opt.icon)} alt="" draggable={false} />
                  )}
                  <span className="dialog-choice-text">
                    <span className="dialog-choice-label">{opt.label}</span>
                    {opt.detail && <span className="dialog-choice-detail">{opt.detail}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="dialog-buttons">
          <button className="dialog-btn dialog-btn-cancel" onClick={cancel}>
            Cancel
          </button>
          {state.type !== "choose" && (
            <button className={confirmClass} onClick={confirm}>
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
