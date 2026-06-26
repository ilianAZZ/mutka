# Changesets

This folder holds **pending changesets** — small notes describing changes that
haven't been released yet. They are the single source of truth for the next
version number and the changelog, so you never set a version by hand.

## The flow

1. **You make a code change.**
2. **You add a changeset** describing it and whether it's a `major`, `minor`, or
   `patch` change:
   ```bash
   pnpm changeset
   ```
   (An AI agent can do this via the `add-changeset` skill instead.) This writes a
   file like `.changeset/added-auto-updater-cedar.md`. Commit it with your change
   — the pre-commit hook reminds you if you forgot.
3. **At release time**, the tooling reads every changeset, takes the **highest**
   bump (major > minor > patch), bumps the version in `package.json`,
   `tauri.conf.json` and `Cargo.toml`, writes `CHANGELOG.md`, deletes the
   consumed changesets, and tags `vX.Y.Z`:
   ```bash
   pnpm release        # bump + changelog + commit + tag
   git push --follow-tags
   ```
   The pushed tag triggers `.github/workflows/release.yml`, which builds and
   publishes the GitHub Release.

## Changeset file format

```md
---
bump: minor
---

One-line summary that lands in the changelog.
```

- `bump` is `major`, `minor`, or `patch`.
- The text under the frontmatter is the changelog entry. Keep it to a clear
  sentence; multiple changesets are grouped by bump level in the changelog.

## Which bump?

- **patch** — bug fix, no behavior change for users writing modules.
- **minor** — new feature, new capability/permission/event, backward-compatible.
- **major** — a breaking change to the module API, `host`/`defineModule` shape,
  the host↔worker protocol, or any documented contract.
