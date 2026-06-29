---
name: cut-release
description: Cut a Mutka release. Releases are driven by release-please + Conventional Commits — merging the auto-generated "release PR" cuts the release; CI builds and publishes. Use when the user wants to ship a release, publish a version, or tag a build.
---

# Skill: Cut a release

Mutka uses **release-please** on top of **Conventional Commits**. You do **not**
hand-edit versions, write the changelog, run a local script, or push a final tag.
The version + `CHANGELOG.md` are computed from commit messages and applied by
merging an auto-maintained PR. See the `commit-conventions` skill and the
"Releasing" section of the root `CLAUDE.md`.

## How it works

On every push to `main`, `.github/workflows/release-please.yml` keeps **one open
release PR** (titled `chore(main): release X.Y.Z`) that accumulates, from the
Conventional Commits since the last release:

- the next version (`fix:` → patch, `feat:` → minor, `feat!:` / `BREAKING CHANGE:` →
  major), bumped in lockstep across `package.json`, `src-tauri/tauri.conf.json`,
  `src-tauri/Cargo.toml`, and both `packages/*/package.json`, and
- the matching `CHANGELOG.md` section.

## Cut a final release — merge the release PR

```bash
gh pr list --label "autorelease: pending"     # find the release PR
gh pr merge <number> --squash                 # merging IS the release trigger
```

On merge, release-please creates the `vX.Y.Z` tag + GitHub Release (changelog as the
body), then `release.yml` builds the universal macOS bundle, attaches
`.dmg`/`.app.tar.gz`/`latest.json`+sig, and publishes `@mutka-explorer/module` +
`@mutka-explorer/create` to npm in lockstep.

### Forcing a specific version (e.g. the first 1.0.0)

release-please computes the number from commits. To pin it, land a commit with a
`Release-As:` footer, then let the release PR update:

```bash
git commit --allow-empty -m "chore: release 1.0.0" -m "Release-As: 1.0.0"
git push
```

## Cut a release candidate — push an `-rc` tag

The release PR already accumulates everything, so rc's are only for **test builds**:

```bash
git tag v1.0.0-rc.1 && git push origin v1.0.0-rc.1
```

A `-`-suffixed tag fires `release.yml` directly and publishes a **pre-release**
(macOS bundle only; not marked "latest", npm publish skipped, `CHANGELOG.md`
untouched). Cut as many as you need, then merge the release PR for the final.

## Watch it

```bash
gh run watch                       # the release-please / build run
gh release view vX.Y.Z             # confirm notes + assets (.dmg, .app.tar.gz, latest.json)
```

The build auto-publishes (signed + notarized in CI), so
`releases/latest/download/latest.json` resolves for the in-app updater.

## Signing (context — repo Actions secrets, not set here)

- **Apple signing/notarization** (double-click open instead of right-click → Open):
  `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
  `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), `APPLE_TEAM_ID`. Unset →
  unsigned build (still installable).
- **Updater signing** (activates the in-app auto-updater): `TAURI_SIGNING_PRIVATE_KEY`
  (+ `_PASSWORD`). Independent of Apple signing.
- **npm publish**: `NPM_TOKEN` (automation token for the `mutka-explorer` org).

See the "Releasing" section of the root `CLAUDE.md` for the full flow.
