import { useEffect } from "react";

/**
 * Blocks the WebView's default behaviour of navigating to a file dropped
 * anywhere in the window (which would white-screen the app). Folder rows handle
 * their own drop; this only prevents the default everywhere else.
 */
export function useExternalDropGuard(): void {
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);
}
