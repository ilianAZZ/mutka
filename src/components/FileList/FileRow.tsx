import React from "react";
import type { FileItem } from "../../core/types";
import type { ColumnDescriptor, ColumnCellState } from "../../core/columns/column.types";
import { FileIcon } from "./FileIcon";

interface FileRowProps {
  item: FileItem;
  isSelected: boolean;
  isCut: boolean;
  isDropTarget: boolean;
  isEven: boolean;
  iconSrc: string | null;
  gridStyle: React.CSSProperties;
  columns: ColumnDescriptor[];
  cellData: Record<string, ColumnCellState> | undefined;
  onClick: (e: React.MouseEvent, item: FileItem) => void;
  onContextMenu: (item: FileItem) => void;
  onAuxClick: (e: React.MouseEvent, item: FileItem) => void;
  onDoubleClick: (e: React.MouseEvent, item: FileItem) => void;
  onDragStart: (e: React.DragEvent, item: FileItem) => void;
  onDragOver: (e: React.DragEvent, item: FileItem) => void;
  onDragLeave: (item: FileItem) => void;
  onDrop: (e: React.DragEvent, item: FileItem) => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  // Pick the unit from the ROUNDED value, not the raw one: 1 decimal of "1023.99"
  // renders as "1024.0", so comparing the raw magnitude leaves e.g. 1048560 B
  // showing "1024.0 KB" instead of rolling over to "1.0 MB". Advance a unit while
  // the value would still round to ≥ 1024 at its display precision.
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (i < units.length - 1 && Number(value.toFixed(1)) >= 1024) {
    value /= 1024;
    i++;
  }
  const decimals = i === units.length - 1 ? 2 : 1;
  return `${value.toFixed(decimals)} ${units[i]}`;
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

function renderCell(state: ColumnCellState | undefined): React.ReactNode {
  if (!state || state === "loading") return null;
  return (
    <>
      {state.icon && <img className="col-extra-icon" src={state.icon} alt="" />}
      {state.text && <span style={state.tint ? { color: state.tint } : undefined}>{state.text}</span>}
      {state.badge && <span className="col-extra-badge">{state.badge}</span>}
    </>
  );
}

export const FileRow = React.memo(function FileRow({
  item, isSelected, isCut, isDropTarget, isEven, iconSrc, gridStyle, columns, cellData,
  onClick, onContextMenu, onAuxClick, onDoubleClick, onDragStart, onDragOver, onDragLeave, onDrop,
}: FileRowProps): React.ReactElement {
  return (
    <div
      draggable
      style={gridStyle}
      data-menu-zone="file"
      className={[
        "file-row",
        isEven ? "file-row--even" : "",
        isSelected ? "selected" : "",
        isCut ? "cut" : "",
        isDropTarget ? "drop-target" : "",
        item.isHidden ? "file-row--hidden" : "",
      ].filter(Boolean).join(" ")}
      onClick={(e) => onClick(e, item)}
      onContextMenu={() => onContextMenu(item)}
      onAuxClick={(e) => onAuxClick(e, item)}
      onDoubleClick={(e) => onDoubleClick(e, item)}
      onDragStart={(e) => onDragStart(e, item)}
      onDragOver={(e) => onDragOver(e, item)}
      onDragLeave={() => onDragLeave(item)}
      onDrop={(e) => onDrop(e, item)}
    >
      <span className="col-name">
        <FileIcon src={iconSrc} isSymlink={item.isSymlink} />
        {item.name}
      </span>
      <span className="col-date">{formatDate(item.modified)}</span>
      <span className="col-type">
        {item.isDir && !item.isPackage ? "Folder" : item.extension?.toUpperCase() ?? "File"}
      </span>
      <span className="col-size">{item.isDir ? "—" : formatSize(item.size)}</span>
      {columns.map((col) => (
        <span key={col.id} className={`col-extra${col.align === "end" ? " col-extra--end" : ""}`}>
          {renderCell(cellData?.[col.id])}
        </span>
      ))}
    </div>
  );
});
