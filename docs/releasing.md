# Releasing Mutka

Mutka releases are driven by **[release-please](https://github.com/googleapis/release-please)**
on top of **[Conventional Commits](https://www.conventionalcommits.org)**. You
never edit a version number, write a changelog, or create a tag by hand. You write
well-formed commit messages; release-please figures out the version, writes the
changelog, and cuts the release when you merge a PR.

## The everyday loop

1. Make a change on a branch.
2. Commit it with a **Conventional Commit** message — the *type* decides the bump:

   | Commit | Bump | Result |
   | --- | --- | --- |
   | `fix: …` | patch | `1.0.0 → 1.0.1` |
   | `feat: …` | minor | `1.0.0 → 1.1.0` |
   | `feat!: …` or a `BREAKING CHANGE:` footer | **major** | `1.0.0 → 2.0.0` |
   | `docs:` `chore:` `refactor:` `test:` `ci:` `build:` `style:` `perf:` | none | no release on its own |

   ```bash
   git commit -m "feat(modules): add a tags panel"
   git commit -m "fix(picker): stop crash on an empty folder"
   git commit -m "feat!: remove host.net.download"      # ! = breaking → major
   ```

   The local `commit-msg` hook (`.githooks/commit-msg`, wired by the `prepare`
   script) checks the format as you commit; the **Commitlint** PR check
   (`.github/workflows/commitlint.yml`) is the gate that can't be `--no-verify`'d.
3. Open a PR and merge it to `main` as usual.

That's the whole author workflow — **no changeset files, no version edits.**

## How a release is cut

On every push to `main`, **release-please** (`.github/workflows/release-please.yml`)
maintains **one open "release PR"** titled like `chore(main): release 1.1.0`. That PR
continuously accumulates, from the commits since the last release:

- the next version (computed from the commit types above), bumped in lockstep across
  `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and the two
  `packages/*/package.json` (see `release-please-config.json`), and
- the matching `CHANGELOG.md` section.

**You cut the release by merging that PR.** On merge, release-please creates the
GitHub Release as a **draft** (`"draft": true` in `release-please-config.json`), and
the `build` job builds the **universal** (Apple Silicon + Intel) macOS bundle on a
`macos-14` runner, uploads the `.dmg`, `.app.tar.gz`, and updater `latest.json` +
signature into the draft, and **only then publishes it**. The npm packages publish too
(see below).

**Why a draft?** A published "Latest" release with no `.dmg` is a real gap: for the
~10–20 min the bundle builds, anyone hitting the download page or `releases/latest`
would get a release they can't install, and the updater would see a `latest.json`
404. So the Release is born hidden (a draft has no "Latest" badge and isn't served by
the updater) and is flipped public only after the binaries are attached. **Un-drafting
is the moment GitHub creates the `vX.Y.Z` tag** — which is why a draft has no tag yet,
so the `build` job checks out the merge **commit SHA** (passed from release-please)
instead of the tag. The rc path never drafts, so it still builds straight from its tag.

> Choosing a specific version (e.g. forcing the first **1.0.0**): add a
> `Release-As: 1.0.0` footer to any commit, and release-please will target that
> version in the release PR.

There is **no local release command** and you never push a final tag yourself —
merging the release PR is the trigger.

## Release candidates (pre-releases)

The release PR already *accumulates* every unreleased change, so "hold everything,
then ship one big release" is just the default — you don't need rc's for that. When
you do want a **test build** before the real release, push an `-rc` tag by hand:

```bash
git tag v1.0.0-rc.1 && git push origin v1.0.0-rc.1
```

A tag with a `-` suffix fires `.github/workflows/release.yml` directly and publishes
a **pre-release** GitHub Release with the macOS bundle, **flagged so it never becomes
"latest"** (updater clients aren't offered it) and **npm publish is skipped**. RC tags
do not touch `CHANGELOG.md` or the release PR — the eventual final release still lists
every change. Cut as many rc's as you need, then merge the release PR for the final.

## The two workflows

- **`release-please.yml`** (on push to `main`) — maintains the release PR; on merge,
  drafts the release, then calls `release.yml` (passing the merge `sha` and `draft:
  true`) to build, attach the bundle, and publish the draft.
- **`release.yml`** — the reusable build-and-publish job. Called by release-please for
  final releases (builds from the `sha`, then un-drafts the release), **and** triggered
  directly by a hand-pushed `v*` tag (rc's — builds from the tag, never drafts). A `-`
  in the tag ⇒ pre-release (not "latest", npm skipped). One build definition serves
  both paths.

The macOS bundle is signed + notarized in CI, so `releases/latest/download/latest.json`
resolves for the in-app updater the moment the final release is published (un-drafted) —
and because publish happens only after the binaries upload, it never resolves to a
release missing its bundle.

## npm packages for module authors

On a **final** release, `release.yml` also runs two **npm publish** jobs that push the
module-author tooling, **versioned in lockstep with the app** (release-please already
bumped their `package.json`, so no stamping):

- **`@mutka-explorer/module`** — the author-facing TypeScript types (generated from
  `src/core/sandbox` at build time, so they can't drift).
- **`@mutka-explorer/create`** — the `npm create @mutka-explorer` scaffolder.

See `packages/CLAUDE.md`. Both need the **`NPM_TOKEN`** repo secret (an npm automation
token for the `mutka-explorer` org). Without it those jobs fail, but the macOS GitHub
Release is unaffected. They are skipped for rc pre-releases.

## Code signing & notarization

Signing is driven by these repo secrets (the workflow already wires them):
`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
`APPLE_ID`, `APPLE_PASSWORD` (an app-specific password), `APPLE_TEAM_ID`. **They are
set today**, so releases ship signed with a Developer ID and notarized — the app
opens with a normal double-click. If the secrets were ever unset, the build would
fall back to **unsigned**, and the user would have to right-click → Open the first
time (Gatekeeper).

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

The app ships the Tauri updater (`tauri-plugin-updater`, prompt mode — the lifecycle
lives in `src/update.ts` as the `UpdateController` store). On launch it polls the
release `latest.json`; if a newer **signed** build exists, the `UpdateToast`
(`src/components/UpdateToast/`) surfaces a Liquid Glass "A new version is available"
notification with an **Update & Restart** button. On accept it downloads (streaming
progress into the toast) + installs + relaunches. Users can also re-check on demand
from **Settings → General → Check for Updates** (the startup poll only runs once, so
this covers an app left open across a release). Updates are verified against the
public key in `tauri.conf.json`.

GitHub's `releases/latest` redirect resolves to the newest **non-prerelease** release,
so `-rc` builds are never offered as updates, even while one exists on the Releases page.

The matching private key must be set as the repo secret
`TAURI_SIGNING_PRIVATE_KEY` (and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if the key
has one). Without it, CI still builds installable bundles but emits no update
signature, so the in-app updater stays dormant.

> The updater does **not** bypass Gatekeeper. For seamless updates the app should
> be signed + notarized (above); otherwise the user hits a Gatekeeper prompt on the
> swapped binary.
