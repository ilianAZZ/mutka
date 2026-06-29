import { useEffect, useRef, useState } from "react";
import "./Breadcrumb.css";

interface Props {
  path: string;
  onNavigate: (path: string) => void;
}

/** Split a path into a navigable root + segments. A virtual scheme path
 *  ("webdav:acc/sub") keeps "webdav:acc" as the root so the local-POSIX split
 *  doesn't mangle it into "/webdav:/acc". */
function parseBreadcrumb(path: string): { rootLabel: string; rootPath: string; segments: string[] } {
  const m = /^([a-z][a-z0-9+.-]*:[^/]*)(\/.*)?$/i.exec(path);
  if (m) {
    return { rootLabel: m[1], rootPath: `${m[1]}/`, segments: (m[2] ?? "").split("/").filter(Boolean) };
  }
  return { rootLabel: "/", rootPath: "/", segments: path.split("/").filter(Boolean) };
}

export function Breadcrumb({ path, onNavigate }: Props) {
  const { rootLabel, rootPath, segments } = parseBreadcrumb(path);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(path);
  const inputRef = useRef<HTMLInputElement>(null);

  // Entering edit mode (Windows-style): prefill with the full path and select it
  // all so the user can copy it or type/paste a new one immediately.
  useEffect(() => {
    if (editing) {
      setDraft(path);
      const input = inputRef.current;
      if (input) {
        input.focus();
        input.select();
      }
    }
  }, [editing, path]);

  function commit(): void {
    // Normalize the typed path: trim, drop a trailing slash (except for root "/").
    let next = draft.trim();
    if (next.length > 1 && next.endsWith("/")) next = next.slice(0, -1);
    setEditing(false);
    if (next && next !== path) onNavigate(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") setEditing(false);
  }

  // A click on the breadcrumb's empty space (not on a segment button) switches to
  // the editable address bar, mirroring Windows Explorer's behaviour.
  function handleBackgroundClick(e: React.MouseEvent): void {
    if (e.target === e.currentTarget) setEditing(true);
  }

  if (editing) {
    return (
      <div id="breadcrumb" className="breadcrumb--editing" data-menu-zone="breadcrumb">
        <input
          ref={inputRef}
          className="breadcrumb-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setEditing(false)}
          spellCheck={false}
        />
      </div>
    );
  }

  return (
    <div
      id="breadcrumb"
      data-menu-zone="breadcrumb"
      data-tauri-drag-region
      onClick={handleBackgroundClick}
      title="Click to edit path"
    >
      <button className="breadcrumb-segment" onClick={() => onNavigate(rootPath)}>
        {rootLabel}
      </button>
      {segments.map((seg, i) => {
        const segPath = rootPath.replace(/\/$/, "") + "/" + segments.slice(0, i + 1).join("/");
        return (
          <span key={segPath} className="breadcrumb-item">
            {/* The root "/" button already provides the leading slash — only put a
                separator between segments, not before the first one. */}
            {i > 0 && <span className="breadcrumb-sep">/</span>}
            <button
              className="breadcrumb-segment"
              onClick={() => onNavigate(segPath)}
            >
              {seg}
            </button>
          </span>
        );
      })}
    </div>
  );
}
