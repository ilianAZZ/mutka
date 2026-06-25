import { useEffect, useState } from "react";
import type { FileItem } from "../../core/types";
import { FileIconRegistry } from "../../core/file-icons/FileIconRegistry";

interface FileIconProps {
  item: FileItem;
}

/**
 * Renders a file's icon. The image comes from FileIconRegistry: a module-supplied
 * override if one exists, otherwise the native macOS icon (fetched once per file
 * type and cached). The data-URI is always placed in an <img src> — never
 * innerHTML — so even an SVG override cannot execute script.
 *
 * A symlink gets a small ↗ overlay badge, like the alias arrow in Finder.
 */
export function FileIcon({ item }: FileIconProps) {
  // Start with whatever is known synchronously (override or already-cached icon).
  const [src, setSrc] = useState<string | null>(() => FileIconRegistry.resolveSync(item));

  useEffect(() => {
    let cancelled = false;
    const known = FileIconRegistry.resolveSync(item);
    setSrc(known);
    if (!known) {
      FileIconRegistry.resolve(item).then((resolved) => {
        if (!cancelled) setSrc(resolved);
      });
    }
    return () => { cancelled = true; };
  }, [item.path, item.extension, item.isDir]);

  return (
    <span className="file-icon">
      {src ? (
        <img className="file-icon-img" src={src} alt="" draggable={false} />
      ) : (
        // Neutral placeholder while the native icon loads (avoids a layout jump).
        <span className="file-icon-placeholder" aria-hidden="true" />
      )}
      {item.isSymlink && <span className="file-icon-symlink" aria-label="Alias">↗</span>}
    </span>
  );
}
