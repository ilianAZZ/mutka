---
name: cut-release
description: Cut a Mutka release. Releases are tag-driven — pushing a vX.Y.Z tag triggers CI to build and publish. Use when the user wants to ship a release, publish a version, or tag a build.
---

# Skill: Cut a release

A Mutka release is **created by pushing a `vX.Y.Z` git tag** — nothing else. The
pushed tag (and only that push) triggers `.github/workflows/release.yml`, which
builds the universal macOS bundle and creates a **draft** GitHub Release with the
`.dmg`, `.app.tar.gz`, and updater `latest.json` + signature attached. CI does
**not** invent the tag, and you must **not** create the tag or the release through
the GitHub web UI — `tauri-action` owns the release for that tag, so a
hand-created one collides.

Versioning is changeset-based: never hand-edit a version number.

## Pre-flight checks

1. **On `main`, clean tree, up to date:**
   ```bash
   git status --porcelain && git rev-parse --abbrev-ref HEAD
   git pull --ff-only
   ```
2. **There are pending changesets** — without them `pnpm release` has nothing to
   bump:
   ```bash
   ls .changeset/*.md   # at least one besides README.md
   ```
   If none, add one first with the `add-changeset` skill.
3. **No tag collision** — the version `pnpm release` will compute must not already
   be tagged (`git tag -l`). If unsure, run `pnpm version:apply` (bumps files
   without tagging) and inspect the result first.

## Cut it

```bash
pnpm release            # consumes changesets → bumps the 3 manifests → CHANGELOG → commit "release: vX.Y.Z" → tag vX.Y.Z
git push --follow-tags  # pushes the commit AND the tag; the tag fires release.yml
```

`pnpm release` runs `scripts/version.mjs --tag`: highest bump across pending
changesets (major > minor > patch), bumps `package.json` + `src-tauri/tauri.conf.json`
+ `src-tauri/Cargo.toml` in lockstep, prepends `CHANGELOG.md`, deletes the consumed
changesets, commits, and tags.

Use `pnpm version:apply` instead if you want to review the diff and commit/tag by
hand.

## After pushing

```bash
gh run watch          # or: gh run list --workflow=release.yml
```

When the run finishes it leaves a **draft** release. Review the build, then publish:

```bash
gh release list
gh release edit vX.Y.Z --draft=false --latest
```

Publishing makes `releases/latest/download/latest.json` resolve — the URL the
in-app updater polls.

## Signing (context — set as repo Actions secrets, not here)

- **Apple signing/notarization** (double-click open instead of right-click → Open):
  `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
  `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), `APPLE_TEAM_ID`. Needs a paid
  Apple Developer account. Unset → unsigned build (still installable).
- **Updater signing** (activates the in-app auto-updater): `TAURI_SIGNING_PRIVATE_KEY`
  (+ `_PASSWORD`). Independent of Apple signing.

See `docs/releasing.md` and `.changeset/README.md`.
