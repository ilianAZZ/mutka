# src-tauri/ — Rust Backend Guide

The Rust backend is a **thin system API layer**. It exposes file system operations
and macOS-native features as Tauri commands callable from TypeScript via `invoke()`.

It must NOT contain business logic. Business logic lives in TypeScript modules.

---

## Files

```
src-tauri/
├── src/
│   ├── main.rs          ← entry point, calls lib::run()
│   └── lib.rs           ← ALL Tauri commands + app setup
├── Cargo.toml           ← Rust dependencies
├── tauri.conf.json      ← window config, transparency, bundle settings
├── build.rs             ← required by tauri-build
├── capabilities/
│   └── default.json     ← Tauri 2 permission system
└── icons/
    └── icon.png         ← 512×512 RGBA PNG (required)
```

---

## Adding a Tauri command

**Step 1**: Add the function to `src/lib.rs`

```rust
// Always use Result<T, String> — Ok resolves the Promise, Err rejects it
#[tauri::command]
fn my_command(path: String, count: u32) -> Result<Vec<String>, String> {
    // map all errors to String with .map_err(|e| e.to_string())
    let result = std::fs::read_dir(&path).map_err(|e| e.to_string())?;
    Ok(vec![])
}
```

**Step 2**: Register it in the `invoke_handler` inside `run()`

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    my_command,    // ← add here
])
```

**Step 3**: Call it from TypeScript

```typescript
import { invoke } from "@tauri-apps/api/core";

// T must match the Rust return type after JSON serialization
const result = await invoke<string[]>("my_command", { path: "/foo", count: 5 });
```

---

## Serialization contract

Rust structs returned from commands must use `#[serde(rename_all = "camelCase")]`
so that snake_case Rust fields map to camelCase TypeScript properties.

```rust
// ✅ correct
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileItem {
    pub is_dir: bool,    // serialized as "isDir"
    pub name: String,    // serialized as "name"
}
```

The matching TypeScript interface in `src/core/types.ts`:
```typescript
interface FileItem {
  isDir: boolean;   // matches "isDir"
  name: string;     // matches "name"
}
```

**Critical**: If you change a Rust struct field, update `src/core/types.ts` in the same commit.
These two must always be in sync.

---

## Command naming convention

Rust command name (snake_case) → TypeScript invoke name (same snake_case string):

| Rust function | TypeScript invoke | What it does |
|---|---|---|
| `read_dir` | `"read_dir"` | List directory contents |
| `copy_files` | `"copy_files"` | Copy files to destination |
| `move_files` | `"move_files"` | Move files to destination |
| `create_file` | `"create_file"` | Create an empty file |
| `create_dir_cmd` | `"create_dir_cmd"` | Create directory (recursively) |
| `rename_item` | `"rename_item"` | Rename / move a single item |
| `delete_item` | `"delete_item"` | Delete file or directory recursively |
| `open_item` | `"open_item"` | Open with macOS default app (`open`) |
| `get_home_dir` | `"get_home_dir"` | Returns `$HOME` |

New commands should follow the same `<verb>_<noun>` pattern.

---

## Error handling rules

Every command returns `Result<T, String>`.

```rust
// ✅ — always propagate with context
fn read_dir(path: String) -> Result<Vec<FileItem>, String> {
    let entries = fs::read_dir(&path)
        .map_err(|e| format!("Cannot read {}: {}", path, e))?;
    // ...
}

// ❌ — never panic in a command
fn bad_command() -> String {
    fs::read_to_string("/etc/passwd").unwrap() // panics → crashes the app
}
```

On the TypeScript side, commands are reached only through `src/core/sandbox/capabilities.ts`
(the single gateway — the one place that calls `invoke`); a module never calls `invoke`
directly. The gateway maps a capability to its command:

```typescript
// src/core/sandbox/capabilities.ts
deleteItem: { permission: "fs:write", run: ([p]) => invoke("delete_item", { path: p }) },
```

A module then calls `host.fs.deleteItem(path)` (which the gateway permission-checks) and
wraps its own logic in try/catch, calling `host.refresh()` after a successful mutation.

---

## macOS-specific setup (lib.rs `run()` function)

The `run()` function sets up:
1. `window-vibrancy` with `NSVisualEffectMaterial::Sidebar` — gives the native blurred background
2. `setup_mouse_navigation()` — NSEvent monitor for mouse back/forward buttons
3. All command handlers

When adding window setup (title bar, decorations, etc.), it goes in the `.setup()` closure.
When adding new Tauri plugins, add them with `.plugin(...)` before `.invoke_handler(...)`.

---

## NSEvent monitoring — `setup_mouse_navigation()`

**Why it exists**: macOS WKWebView intercepts mouse back/forward buttons before JS sees them.
The DOM `mousedown` event with `button === 3/4` never fires in Tauri. The fix is a Rust
`NSEvent` local monitor that runs before WKWebView dispatches the event.

**What it listens to**: `NSEventMaskSwipe` (1 << 31 = type 31).
Mouse drivers (Logitech Options+, SteerMouse, etc.) convert the physical back/forward buttons
to swipe gestures. This is macOS convention — raw HID mice without drivers emit
`NSEventTypeOtherMouseDown` (type 25) instead, which is handled by the DOM fallback in
`src/core/input-manager/InputManager.ts`. Both paths surface as the `"input:mouse-navigate"`
event, which the `src/sandbox-builtins/mouse-navigation.ts` module reacts to via
`host.nav` (it never calls `invoke` directly).

**deltaX direction** — macOS swipe convention, universal across all drivers:

- `deltaX > 0` (swipe right) → go **back**
- `deltaX < 0` (swipe left) → go **forward**

This matches the native two-finger trackpad gesture in Safari/Finder. It is NOT inverted,
NOT specific to Logitech, and would be the same on any Mac.

**Debounce**: `LAST_NAV` mutex (400 ms window). Mouse drivers that use swipe conversion
fire a burst of 5–15 events per physical click. Without the debounce, a single press
navigates multiple times.

**Block lifetime**: the `ConcreteBlock` is heap-copied with `.copy()` before being passed
to ObjC, then `std::mem::forget(block)` prevents Rust from releasing it. ObjC manages
the lifetime via retain/release on the monitor object.

For a full guide on adding new NSEvent monitors, see:
`.claude/skills/macos-nsevent.md`

---

## Cargo.toml dependencies

Current dependencies and why they exist:

| Crate | Version | Why |
| --- | --- | --- |
| `tauri` | 2 | Core Tauri framework |
| `window-vibrancy` | 0.5 | Native macOS NSVisualEffectView |
| `serde` | 1 (derive) | JSON serialization of Rust structs |
| `serde_json` | 1 | JSON parsing |
| `objc` | 0.2 | ObjC `msg_send!` macros for NSEvent monitoring |
| `block` | 0.1 | ObjC block creation for `addLocalMonitorForEventsMatchingMask:handler:` |

When adding a new crate, add a comment explaining why it's needed.

---

## What Rust must NOT do

- **No business logic**: File filtering, sorting preferences, module configuration → TypeScript
- **No state**: Commands are stateless. State lives in the frontend.
- **No macOS UI** (NSMenu, NSAlert, etc.): All UI is React. Rust handles system calls only.
