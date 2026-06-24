import { useCallback } from "react";
import { FileItem } from "../core/types";
import "./FileList.css";

interface Props {
  files: FileItem[];
  selected: FileItem[];
  cutItems: FileItem[];
  onSelect: (items: FileItem[]) => void;
  onOpen: (item: FileItem) => void;
  onModifierOpen?: (item: FileItem, modifiers: { ctrl: boolean; meta: boolean }) => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FileIcon({ item }: { item: FileItem }) {
  if (item.isDir) return <span className="file-icon folder-icon">📁</span>;
  const icons: Record<string, string> = {
    png: "🖼️", jpg: "🖼️", jpeg: "🖼️", gif: "🖼️", svg: "🖼️", webp: "🖼️",
    mp4: "🎬", mov: "🎬", avi: "🎬", mkv: "🎬",
    mp3: "🎵", wav: "🎵", flac: "🎵", aac: "🎵",
    pdf: "📄",
    zip: "🗜️", tar: "🗜️", gz: "🗜️", rar: "🗜️",
    ts: "📝", tsx: "📝", js: "📝", jsx: "📝",
    rs: "📝", py: "📝", go: "📝", swift: "📝",
  };
  const icon = item.extension ? (icons[item.extension.toLowerCase()] ?? "📄") : "📄";
  return <span className="file-icon">{icon}</span>;
}

export function FileList({ files, selected, cutItems, onSelect, onOpen, onModifierOpen }: Props) {
  const selectedPaths = new Set(selected.map((f) => f.path));
  const cutPaths = new Set(cutItems.map((f) => f.path));

  const handleClick = useCallback(
    (e: React.MouseEvent, item: FileItem) => {
      if (e.metaKey || e.ctrlKey) {
        if (selectedPaths.has(item.path)) {
          onSelect(selected.filter((f) => f.path !== item.path));
        } else {
          onSelect([...selected, item]);
        }
      } else if (e.shiftKey && selected.length > 0) {
        const last = selected[selected.length - 1];
        const lastIdx = files.findIndex((f) => f.path === last.path);
        const thisIdx = files.findIndex((f) => f.path === item.path);
        const [from, to] = lastIdx < thisIdx ? [lastIdx, thisIdx] : [thisIdx, lastIdx];
        onSelect(files.slice(from, to + 1));
      } else {
        onSelect([item]);
      }
    },
    [files, selected, selectedPaths, onSelect]
  );

  return (
    <div id="file-list" onClick={(e) => { if (e.target === e.currentTarget) onSelect([]); }}>
      {files.length === 0 ? (
        <div className="file-list-empty">This folder is empty</div>
      ) : (
        <>
          <div className="file-list-header">
            <span className="col-name">Name</span>
            <span className="col-date">Date modified</span>
            <span className="col-type">Type</span>
            <span className="col-size">Size</span>
          </div>
          <div className="file-list-body">
            {files.map((item) => (
              <div
                key={item.path}
                className={[
                  "file-row",
                  selectedPaths.has(item.path) ? "selected" : "",
                  cutPaths.has(item.path) ? "cut" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={(e) => handleClick(e, item)}
                onDoubleClick={(e) => {
                  if ((e.ctrlKey || e.metaKey) && onModifierOpen) {
                    onModifierOpen(item, { ctrl: e.ctrlKey, meta: e.metaKey });
                  } else {
                    onOpen(item);
                  }
                }}
              >
                <span className="col-name">
                  <FileIcon item={item} />
                  {item.name}
                </span>
                <span className="col-date">{formatDate(item.modified)}</span>
                <span className="col-type">
                  {item.isDir ? "Folder" : item.extension?.toUpperCase() ?? "File"}
                </span>
                <span className="col-size">{item.isDir ? "—" : formatSize(item.size)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
