---
name: update-docs
description: Keep documentation in sync whenever you change an interface, type, capability, permission, event, command, or any other public contract. Run this BEFORE finishing a change that touches a contract.
---

# Skill: Update the docs when a contract changes

Mutka is a community-first, modular project: the docs ARE part of the public API.
A module author outside this repo reads them to build against the core. So any change
to a **contract** must update its documentation in the same change — never leave it stale.

## What counts as a "contract change"

Trigger this skill whenever you add, remove, rename, or change the shape of any of:

- A **type / interface** in `src/core/types.ts` (the "law" — see CLAUDE.md philosophy #2)
- A **capability** in `src/core/sandbox/capabilities.ts` (the whole module vocabulary)
- A **permission** in `ModulePermission` (the enum gating capabilities)
- The **`host` surface** handed to `setup()` (`host.fs.*`, `host.ui.*`, `host.nav.*`, …)
- The **`defineModule` shape** (`src/core/sandbox/defineModule.ts`) authors write against
- The **module protocol** (`src/core/sandbox/protocol.ts` — the host ↔ worker wire format,
  including the `UINode` / `FormSchema` vocabulary)
- An **event** on the bus (`src/core/event-bus/events.ts`) or the sandbox **event whitelist**
- A **Tauri command** signature in `src-tauri/src/lib.rs`
- A **command, shortcut, or openHandler** contributed by a built-in module
- Any **architectural flow** (discovery, dispatch, gateway, dialog, watching)

If the change is purely internal (refactor, rename of a private helper, bug fix with no
shape change), no doc update is needed.

## Where each thing is documented — update the matching file(s)

| You changed…                                    | Update CLAUDE.md…                                                    | Update website MDX…                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| A capability or its required permission         | "Capabilities and the permissions they require" table               | `website/content/docs/modules/permissions.mdx` capability tables    |
| A `ModulePermission` value                      | `ModulePermission` list + the capability table                      | `website/content/docs/modules/permissions.mdx` permission enum table |
| The `host` surface or `defineModule` shape      | Module-system section                                               | `website/content/docs/modules/writing-a-module.mdx` host API table  |
| The host ↔ worker protocol / `UINode` vocabulary| "Declarative UI" section                                            | `website/content/docs/modules/declarative-ui.mdx`                   |
| An event or the event whitelist                 | (if it's a subscribable/notify-only change)                         | `website/content/docs/modules/events-and-watching.mdx`              |
| An architectural flow                           | "Key architectural flows" (if shaped)                               | `website/content/docs/architecture.mdx`                             |
| A Tauri command                                 | Capability table (Backed-by column) + `src-tauri/CLAUDE.md`         | (only if it backs a new capability — update the capability tables)  |
| The security model (gateway, isolation, install) | (if it's a contract change)                                        | `website/content/docs/modules/security.mdx`                         |
| The author-facing types (`host`/`defineModule`/`protocol.ts`/re-exported types) | `packages/CLAUDE.md`; rebuild `packages/module-sdk`; add NEW types to `packages/module-sdk/src/index.ts`'s export list | `website/content/docs/modules/writing-a-module.mdx` host API table |
| Storage, network, or secrets capabilities       | Capability table                                                     | `website/content/docs/modules/storage-network-secrets.mdx`          |
| Virtual filesystem / `fileSystemProviders`      | Module-system section                                               | `website/content/docs/modules/virtual-file-system.mdx`              |
| Open handlers / match shape                     | Module-system section                                               | `website/content/docs/modules/open-handlers.mdx`                   |
| Columns / file icons                            | Module-system section                                               | `website/content/docs/modules/columns-and-icons.mdx`               |
| Publishing / discovery flow                     | (if shaped)                                                          | `website/content/docs/modules/publishing-a-module.mdx`              |
| A new file / moved file / new directory         | "Project structure" tree + the nearest per-dir `CLAUDE.md`          | —                                                                    |
| Anything resolving an "Open question"           | Move it out of "Open questions for future decisions"                | —                                                                    |

The per-directory `CLAUDE.md` files (`src/CLAUDE.md`, `src/core/CLAUDE.md`,
`src/components/CLAUDE.md`, `src-tauri/CLAUDE.md`, `packages/CLAUDE.md`) document local
rules — update the one closest to the file you changed.

The **website MDX pages** (`website/content/docs/`) are the single public canonical
documentation for module authors. They are the primary docs to keep in sync.

## Step-by-step

1. **Identify the contract** you touched from the list above.
2. **Find every doc that references it.** Grep the CLAUDE.md files AND the website MDX
   for the old name/shape so nothing stale survives a rename:
   ```bash
   grep -rn "OldName" CLAUDE.md src/**/CLAUDE.md src-tauri/CLAUDE.md website/content/docs/
   ```
3. **Update the matching file(s)** from the table — both the CLAUDE.md column AND the
   website MDX column. Keep examples compiling — if you changed a signature, fix every
   code snippet that uses it.
4. **Update the project-structure tree** in the root `CLAUDE.md` if you added, removed, or
   moved a file or directory.
5. **Resolve open questions**: if your change answers an item under "Open questions for
   future decisions", remove it and record the decision where it belongs.
6. **Re-read your edit** end-to-end so prose, tables, and code samples agree.

## Rules

- Docs and code change in the **same commit** — never "I'll document it later".
- A renamed symbol must not survive anywhere in the docs. Grep to be sure.
- Match the existing doc's tone and format (tables, ASCII diagrams, fenced examples).
- Do not invent docs for internal-only changes. This skill is about **contracts**.
- The generated API reference (`website/content/docs/api/`) is NOT hand-edited — it
  regenerates from source via `npm run docs:api` in the website directory. Never hand-edit
  files under `api/`.
