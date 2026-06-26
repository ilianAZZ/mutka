import { Puzzle } from "lucide-react";
import { Breadcrumb } from "../Breadcrumb/Breadcrumb";

interface ToolbarProps {
  currentDir: string;
  flashedBtn: "back" | "forward" | null;
  canGoBack: boolean;
  canGoForward: boolean;
  onNavigate: (path: string) => void;
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  onRefresh: () => void;
  onOpenModules: () => void;
  onOpenSettings: () => void;
}

/** The window toolbar: nav segment, breadcrumb path, refresh + modules + settings actions. */
export function Toolbar({
  currentDir,
  flashedBtn,
  canGoBack,
  canGoForward,
  onNavigate,
  onBack,
  onForward,
  onUp,
  onRefresh,
  onOpenModules,
  onOpenSettings,
}: ToolbarProps) {
  return (
    <div id="toolbar" data-tauri-drag-region>
      <div className="toolbar-nav" data-tauri-drag-region>
        <div className="toolbar-segment">
          <button
            className={`seg-btn${flashedBtn === "back" ? " seg-btn--flash" : ""}`}
            onClick={onBack}
            disabled={!canGoBack}
            title="Back (⌘[)"
          >‹</button>
          <span className="seg-divider" />
          <button
            className={`seg-btn${flashedBtn === "forward" ? " seg-btn--flash" : ""}`}
            onClick={onForward}
            disabled={!canGoForward}
            title="Forward (⌘])"
          >›</button>
        </div>
        <button className="toolbar-btn" onClick={onUp} title="Up">↑</button>
      </div>

      <Breadcrumb path={currentDir} onNavigate={onNavigate} />

      <div className="toolbar-actions" data-tauri-drag-region>
        <button className="toolbar-btn" onClick={onRefresh} title="Refresh">↻</button>
        <button className="toolbar-btn" onClick={onOpenModules} title="Modules">
          <Puzzle size={15} strokeWidth={1.75} />
        </button>
        <button className="toolbar-btn" onClick={onOpenSettings} title="Settings (⌘,)">⚙</button>
      </div>
    </div>
  );
}
