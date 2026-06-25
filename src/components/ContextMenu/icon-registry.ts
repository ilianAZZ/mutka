import {
  type LucideIcon,
  Copy,
  Scissors,
  ClipboardPaste,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  SquarePlus,
  FolderOpen,
  File,
  Folder,
  Search,
  Star,
  Tag,
  Share2,
  Download,
  Upload,
  Eye,
  EyeOff,
  Info,
  Settings,
  Link,
  ExternalLink,
  Archive,
  Package,
  Image,
  FileText,
  Music,
  Video,
  Code,
  Terminal,
  Cloud,
  CloudUpload,
  CloudDownload,
  Lock,
  Unlock,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

/**
 * The exhaustive map of icon names a module may use.
 * Keys are the strings module authors pass in action.icon.
 * Values are the actual Lucide React components — never exposed to module code.
 *
 * To add an icon: import it above, add an entry here, and export it in ICON_REGISTRY.
 * Community modules that need a missing icon can open a PR adding it here.
 */
export const ICON_REGISTRY: Record<string, LucideIcon> = {
  // Clipboard
  "copy":            Copy,
  "cut":             Scissors,
  "paste":           ClipboardPaste,

  // File operations
  "new-file":        FilePlus,
  "new-folder":      FolderPlus,
  "rename":          Pencil,
  "delete":          Trash2,
  "new-tab":         SquarePlus,

  // Navigation / open
  "open-folder":     FolderOpen,
  "file":            File,
  "folder":          Folder,

  // View / display
  "eye":             Eye,
  "eye-off":         EyeOff,
  "zoom-in":         ZoomIn,
  "zoom-out":        ZoomOut,
  "refresh":         RefreshCw,

  // Info / meta
  "info":            Info,
  "search":          Search,
  "star":            Star,
  "tag":             Tag,
  "settings":        Settings,
  "lock":            Lock,
  "unlock":          Unlock,

  // Share / transfer
  "share":           Share2,
  "download":        Download,
  "upload":          Upload,
  "link":            Link,
  "external-link":   ExternalLink,
  "archive":         Archive,
  "package":         Package,

  // Cloud
  "cloud":           Cloud,
  "cloud-upload":    CloudUpload,
  "cloud-download":  CloudDownload,

  // File types
  "image":           Image,
  "text-file":       FileText,
  "music":           Music,
  "video":           Video,
  "code":            Code,
  "terminal":        Terminal,
};

/**
 * All known icon names — use this for autocomplete in action.icon.
 * Unknown strings are accepted at runtime but render as nothing.
 */
export type ContextMenuIconName = keyof typeof ICON_REGISTRY;
