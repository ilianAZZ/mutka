---
name: new-tauri-command
description: Add a new Tauri command (Rust function + invoke_handler registration + TypeScript invoke call) to expose backend filesystem or macOS operations to the frontend.
---

# Skill: Add a new Tauri command

Use this skill when a module needs to perform a file system or macOS system operation.

## When to add a Rust command

Add a Tauri command when you need to:
- Read or write the file system
- Execute a system process (e.g. `open`, `trash`)
- Access macOS APIs not available via web APIs
- Perform CPU-intensive operations that would block the UI thread

Do NOT add a Rust command for:
- Business logic (filtering, sorting, state management)
- UI operations
- Module configuration

## Step-by-step

### 1. Define the command in `src-tauri/src/lib.rs`

```rust
// Always: Result<T, String> — Ok resolves the Promise, Err rejects it
// Always: map all errors with .map_err(|e| e.to_string())
#[tauri::command]
fn my_new_command(path: String, flag: bool) -> Result<Vec<String>, String> {
    let result = some_operation(&path)
        .map_err(|e| format!("my_new_command failed for {}: {}", path, e))?;
    Ok(result)
}
```

### 2. Register it in the invoke_handler (still in `lib.rs`)

Find the `tauri::generate_handler!` macro and add the function name:

```rust
.invoke_handler(tauri::generate_handler![
    read_dir,
    copy_files,
    // ... existing commands ...
    my_new_command,   // ← add here
])
```

### 3. If the command returns a struct, add camelCase serialization

```rust
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MyStruct {
    pub file_path: String,    // serialized as "filePath"
    pub is_hidden: bool,      // serialized as "isHidden"
}
```

### 4. Add the matching TypeScript type in `src/core/types.ts`

```typescript
export interface MyStruct {
  filePath: string;   // matches "filePath" from Rust
  isHidden: boolean;  // matches "isHidden" from Rust
}
```

### 5. Call it from your module

```typescript
import { invoke } from "@tauri-apps/api/core";
import type { MyStruct } from "../../core/types";

// Always type the generic parameter
const result = await invoke<MyStruct[]>("my_new_command", {
  path: "/some/path",
  flag: true,
});
```

## Rules

- Command name (string passed to `invoke`) must exactly match the Rust function name
- All parameters are passed as a single object `{ key: value }`, matching Rust parameter names
- Rust parameter names are snake_case; TypeScript object keys are also snake_case (they match)
- The generic type `<T>` in `invoke<T>()` must match the Rust `Ok(T)` return type
- If the Rust function returns `Result<(), String>`, use `invoke<void>()` or `await invoke(...)`

## Compile and verify

After making Rust changes, check that it compiles:
```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

The dev server hot-reloads TypeScript but does NOT hot-reload Rust.
Rust changes require restarting `npm run tauri dev`.
