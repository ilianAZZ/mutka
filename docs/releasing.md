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

## npm packages for module authors (published on the same tag)

The same `v*` tag also runs two **npm publish** jobs (`publish-sdk`, `publish-create`)
that push the module-author tooling, **versioned in lockstep with the app** (each job
stamps the version from the tag):

- **`@mutka-explorer/module`** — the author-facing TypeScript types (generated from
  `src/core/sandbox` at build time, so they can't drift).
- **`@mutka-explorer/create`** — the `npm create @mutka-explorer` scaffolder.

See `packages/CLAUDE.md`. Both need the **`NPM_TOKEN`** repo secret (an npm automation
token for the `mutka-explorer` org). Without it those jobs fail, but the macOS GitHub
Release is unaffected. They run only on a real `v*` tag, not on a manual
`workflow_dispatch`.

## Code signing & notarization

The build is **unsigned** unless these repo secrets are set (the workflow already
wires them): `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`,
`APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` (an app-specific password),
`APPLE_TEAM_ID`. Unsigned apps run, but the user must right-click → Open the first
time (Gatekeeper). Signed + notarized apps open with a normal double-click.

### Building the `APPLE_CERTIFICATE` `.p12` (two traps that fail the build)

`APPLE_CERTIFICATE` is the base64 of a `.p12` containing a **Developer ID
Application** certificate **and** its private key. Two mistakes each fail the
`tauri build` codesign step:

1. **Wrong certificate type.** It must be **Developer ID Application** (direct
   distribution). *Apple Distribution* / *iPhone Distribution* (App Store) certs do
   **not** work — the build errors with `certificate ... does not match provided
   identity`. `APPLE_SIGNING_IDENTITY` must equal the cert's exact subject CN, e.g.
   `Developer ID Application: Your Name (TEAMID)` — check with
   `security find-identity -v -p codesigning` (the cert only appears there if its
   private key is present on that machine).
2. **OpenSSL 3 `.p12` format.** If you build the `.p12` with OpenSSL 3.x, export it
   with `-legacy`, else Apple's `security import` on the runner fails with
   `MAC verification failed during PKCS12 import (wrong password?)` — even when the
   password is correct. The runner's `security` tool can't read OpenSSL 3's default
   AES-256/SHA-256 encryption.

Deterministic recipe (no Keychain needed — generate the key, create the cert from
the CSR, bundle, and **verify before uploading**):

```bash
# 1. key + CSR
openssl req -new -newkey rsa:2048 -nodes -keyout devid.key -out devid.csr \
  -subj "/emailAddress=you@example.com/CN=Your Name Developer ID/C=US"
# 2. upload devid.csr at developer.apple.com → Certificates → + → Developer ID
#    Application → G2 Sub-CA → download developerID_application.cer
# 3. bundle key + cert into a legacy-format .p12 (set an export password)
openssl x509 -inform DER -in developerID_application.cer -out devid.pem
openssl pkcs12 -export -out devid.p12 -inkey devid.key -in devid.pem \
  -certpbe PBE-SHA1-3DES -keypbe PBE-SHA1-3DES -macalg sha1 -legacy
# 4. VERIFY it's the right cert AND the password opens it before uploading
openssl pkcs12 -in devid.p12 -nokeys -legacy -passin pass:THEPASSWORD \
  | openssl x509 -noout -subject     # must show CN=Developer ID Application: ...
# 5. set the secrets
base64 -i devid.p12 | gh secret set APPLE_CERTIFICATE
gh secret set APPLE_CERTIFICATE_PASSWORD     # the export password from step 3
```

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
