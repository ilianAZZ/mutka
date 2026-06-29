---
name: commit-conventions
description: How to write Mutka commit messages. Mutka uses Conventional Commits — the commit type drives the next version (fix→patch, feat→minor, feat!→major) that release-please cuts. Use whenever committing to this repo.
---

# Skill: Commit message conventions

Mutka releases are computed by **release-please** from **Conventional Commits**, so
the commit message is not just prose — its *type* decides the next version and lands
in `CHANGELOG.md`. Always write commits in this format.

## Format

```
type(scope)?: subject

optional body

optional footer
```

- **type** (required): one of
  `feat fix docs style refactor perf test build ci chore revert`.
- **scope** (optional): the area touched, lower-case — e.g. `modules`, `picker`,
  `gateway`, `sdk`, `rust`. `feat(modules): …`.
- **subject**: imperative, lower-case, no trailing period — "add", not "added".

## The type → release mapping (the important part)

| Type | Release bump | When |
| --- | --- | --- |
| `fix:` | **patch** (1.0.0 → 1.0.1) | a bug fix |
| `feat:` | **minor** (1.0.0 → 1.1.0) | a new, backward-compatible feature/capability/permission/event/Tauri command |
| `feat!:` or any type with a `!`, or a `BREAKING CHANGE:` footer | **MAJOR** (1.0.0 → 2.0.0) | a breaking change to the module API — `host`/`defineModule`/`protocol.ts`/any documented contract |
| `docs:` `chore:` `refactor:` `test:` `ci:` `build:` `style:` `perf:` | none | doesn't cut a release by itself |

### Breaking changes — use `!`

Add a `!` before the `:` for anything that breaks a module author's code, and explain
the migration in a `BREAKING CHANGE:` footer:

```
feat!: remove host.net.download

BREAKING CHANGE: host.net.download/upload are gone. Read bytes with
host.fs.readBytes and pass them as the request body; save responses with
host.sys.writeTempFile.
```

Either the `!` or the `BREAKING CHANGE:` footer forces a **major** bump — use them
for `host` / `defineModule` / `protocol.ts` / capability / permission removals or
signature changes.

## Examples

```
feat(modules): add a tags panel to the sidebar
fix(picker): stop crash when opening an empty folder
perf(icons): batch icon rendering off the main thread
docs: document the network permission tiers
refactor(gateway): extract dispatchCapability helper      # no release
feat!: rename host.board.* to host.clipboard.*            # major
```

## Enforcement

- **Local**: `.githooks/commit-msg` (wired by the `prepare` script →
  `core.hooksPath`) rejects non-conforming messages. Bypass a one-off with
  `git commit --no-verify`.
- **PR gate**: `.github/workflows/commitlint.yml` runs commitlint on every commit in
  a PR — this one can't be bypassed, so a malformed message blocks the merge.

Get the type right and the release pipeline is fully automatic — see the
`cut-release` skill.
