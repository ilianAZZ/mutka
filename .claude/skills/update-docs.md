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

| You changed…                                    | Update…                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| A capability or its required permission         | `CLAUDE.md` "Capabilities and the permissions they require" table   |
| A `ModulePermission` value                      | `CLAUDE.md` `ModulePermission` list + the capability table          |
| The `host` surface or `defineModule` shape      | `CLAUDE.md` module-system section + `docs/architecture.md`          |
| The host ↔ worker protocol / `UINode` vocabulary| `docs/architecture.md` + `CLAUDE.md` "Declarative UI" section       |
| An event or the event whitelist                 | `docs/events.md`                                                     |
| An architectural flow                           | `docs/flows.md` (+ `CLAUDE.md` "Key architectural flows" if shaped) |
| A Tauri command                                 | `CLAUDE.md` capability table (Backed-by column) + `src-tauri/CLAUDE.md` |
| The author-facing types (`host`/`defineModule`/`protocol.ts`/re-exported types) | also: `COMMUNITY_MODULES.md` + `packages/CLAUDE.md`; the published `@mutka-explorer/module` d.ts **regenerates from source** (rebuild `packages/module-sdk`), so add a NEW author-facing type to `packages/module-sdk/src/index.ts`'s export list |
| A new file / moved file / new directory         | `CLAUDE.md` "Project structure" tree + the nearest per-dir `CLAUDE.md` |
| Anything resolving an "Open question"           | Move it out of `CLAUDE.md` "Open questions for future decisions"     |

The per-directory `CLAUDE.md` files (`src/CLAUDE.md`, `src/core/CLAUDE.md`,
`src/components/CLAUDE.md`, `src-tauri/CLAUDE.md`, `packages/CLAUDE.md`) document local
rules — update the one closest to the file you changed.

## Step-by-step

1. **Identify the contract** you touched from the list above.
2. **Find every doc that references it.** Grep the docs and CLAUDE.md files for the old
   name/shape so nothing stale survives a rename:
   ```bash
   grep -rn "OldName" CLAUDE.md docs/ src/**/CLAUDE.md src-tauri/CLAUDE.md
   ```
3. **Update the matching file(s)** from the table. Keep examples compiling — if you changed
   a signature, fix every code snippet that uses it.
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
