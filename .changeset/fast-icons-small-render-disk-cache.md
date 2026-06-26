---
bump: patch
---

Make opening a folder dramatically faster. Native file-type icons were the bottleneck (~1.1s per folder of fresh types): each icon was rendered by a synchronous, per-type Tauri command that ran on the main thread and blocked the UI, and encoded the icon's full multi-size TIFF (up to 512–1024px) to PNG.

Now icons render off the main thread, in one batched async call per folder (`icons_for_types`), encoding a single small (64px) representation. Each type-keyed icon is persisted to `~/.mutka/icon-cache` and that cache is warmed into memory at launch (`preload_icon_cache`), so a previously-seen file type renders with zero IPC and no placeholder flash. Falls back to the full render for icons without a bitmap representation. The old `icon_for_type` command is removed (replaced by `icons_for_types`).
