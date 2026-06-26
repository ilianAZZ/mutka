# Releasing Mutka

Mutka uses **changeset-based versioning**: you never edit a version number by
hand. You describe each change, and the tooling deduces the next version, writes
the changelog, tags it, and CI builds + publishes the GitHub Release.

## The everyday loop

1. Make a code change.
2. Add a changeset describing it (bump + summary):
   ```bash
   pnpm changeset            # interactive: pick patch/minor/major, write a summary
   ```
   (Or, with an AI agent, the `add-changeset` skill.) Commit the generated
   `.changeset/*.md` alongside your change. The pre-commit hook
   (`.githooks/pre-commit`) blocks a source-changing commit that has no changeset
   — bypass with `git commit --no-verify` for genuinely version-less commits.

## Cutting a release

```bash
pnpm release              # consumes changesets → bumps version → CHANGELOG → commit → tag vX.Y.Z
git push --follow-tags    # the tag triggers the release workflow
```

`pnpm release` runs `scripts/version.mjs`, which:

- takes the **highest** bump across all pending changesets (major > minor > patch),
- bumps the version in `package.json`, `src-tauri/tauri.conf.json`, and
  `src-tauri/Cargo.toml` (the three are kept in lockstep),
- prepends a section to `CHANGELOG.md`,
- deletes the consumed changesets,
- commits `release: vX.Y.Z` and creates the `vX.Y.Z` tag.

Use `pnpm version:apply` instead of `pnpm release` if you want to bump the files
but commit/tag yourself.

## What CI does (`.github/workflows/release.yml`)

On a pushed `v*` tag the workflow:

1. re-syncs the version from the tag into the manifests (belt-and-suspenders),
2. builds a **universal** (Apple Silicon + Intel) macOS bundle on a `macos-14` runner,
3. creates a **draft** GitHub Release and uploads the `.dmg`, `.app.tar.gz`, and
   (for the updater) `latest.json` + signature.

It's a draft so you can sanity-check the build before clicking **Publish**.
Publishing makes `releases/latest/download/latest.json` resolve, which is the URL
the in-app updater polls.

## Code signing & notarization

The build is **unsigned** unless these repo secrets are set (the workflow already
wires them): `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`,
`APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` (an app-specific password),
`APPLE_TEAM_ID`. Unsigned apps run, but the user must right-click → Open the first
time (Gatekeeper). Signed + notarized apps open with a normal double-click.

## Auto-updates

The app ships the Tauri updater (`tauri-plugin-updater`, prompt mode — see
`src/update.ts`). On launch it polls the release `latest.json`; if a newer **signed**
build exists it prompts the user, then downloads + installs + relaunches. Updates
are verified against the public key in `tauri.conf.json`.

The matching private key must be set as the repo secret
`TAURI_SIGNING_PRIVATE_KEY` (and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if the key
has one). Without it, CI still builds installable bundles but emits no update
signature, so the in-app updater stays dormant.

> The updater does **not** bypass Gatekeeper. For seamless updates the app should
> be signed + notarized (above); otherwise the user hits a Gatekeeper prompt on the
> swapped binary.
