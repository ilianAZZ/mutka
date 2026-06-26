---
name: add-changeset
description: Create a changeset describing the current changes (major/minor/patch + summary) so the release version and CHANGELOG are deduced automatically. Use after making code changes, before committing.
---

# Skill: Add a changeset

Mutka deduces its release version from **changesets** — small markdown notes in
`.changeset/`. Never edit a version number by hand. When you finish a change that
should ship, add a changeset describing it.

## When to add one

Add a changeset for any commit that touches `src/`, `src-tauri/src/`, or the
manifests (`package.json`, `tauri.conf.json`, `Cargo.toml`). The pre-commit hook
(`scripts/check-changeset.mjs`) blocks such commits if none is present.

Skip it for docs-only, chore, or changeset-only commits (the hook allows those).

## Step-by-step

### 1. Inspect what changed

```bash
git diff --cached --name-only   # staged
git diff --stat                 # or unstaged
```

### 2. Decide the bump

| Bump    | Use when                                                                       |
| ------- | ------------------------------------------------------------------------------ |
| `patch` | Bug fix, internal refactor, no change to how module authors write code.        |
| `minor` | New feature, **new capability/permission/event**, new Tauri command — backward compatible. |
| `major` | **Breaking** change to the module API: `host`/`defineModule` shape, the host↔worker protocol (`protocol.ts`), capability semantics, or any documented contract. |

When several changes are staged, pick the **highest** applicable bump.

### 3. Write the changeset file

Create `.changeset/<short-slug>.md` (slug = a few kebab-case words from the
summary). Format:

```md
---
bump: minor
---

Add in-app auto-updater: the app checks the GitHub Release on launch and prompts before installing a signed update.
```

- The summary line lands verbatim in `CHANGELOG.md`, grouped by bump level.
- Write it for a reader of the changelog (what changed + why it matters), not as
  a git message.

### 4. Stage it with your change

```bash
git add .changeset/<short-slug>.md
```

## How it gets consumed (context — you don't run this)

At release time `pnpm release` runs `scripts/version.mjs`, which takes the highest
bump across all changesets, bumps the three manifests, writes `CHANGELOG.md`,
deletes the consumed changesets, and tags `vX.Y.Z`. Pushing the tag triggers
`.github/workflows/release.yml`. See `.changeset/README.md` and `docs/releasing.md`.
