# Release Runbook

Canonical release process for synchronized version bumps and npm publishes.

## Goal

Keep release versions synchronized to the same `X.Y.Z` across these release surfaces:

- `CHANGELOG.md` (`vX.Y.Z`)
- `packages/http-client/package.json`
- `packages/cli/package.json`
- `packages/cli/package.json` dependency on `@etsysentry/http-client` (`^X.Y.Z`)

## Changelog Writing Standard

Write changelog entries for users, not implementation internals.

- Describe user-visible capabilities, behavior changes, fixes, and breaking changes.
- Use product language ("Added shop tracking in the CLI"), not repo/file language
  ("Added `docs/*`", "Updated package.json", "Added changelog file").
- Include only meaningful outcomes for users/operators/integrators.
- If a change has no user-visible impact, omit it from `CHANGELOG.md`.
- For the first release in this repository:
  - summarize the entire currently shipped system baseline in `vX.Y.Z`
  - cover core surfaces (dashboard, API, CLI, npm client, and operations)

## SemVer Prompt Policy (Agent Behavior)

- Do not proactively mention version bumps for non-breaking API changes.
- If a change is backward-incompatible, always mention it and suggest a version bump.
- Breaking-change bump guidance:
  - `0.x.y` -> recommend a `minor` bump.
  - `1.x.y+` -> recommend a `major` bump.

Compatibility posture:

- Prefer clean breaks over compatibility layers.
- Do not add legacy aliases, fallbacks, or compatibility shims unless explicitly requested.

## Prerequisites

- Repo-root `.env` contains a valid `NPM_TOKEN`.
- Repo-root `.npmrc` is configured for npm registry auth.
- You are on the release branch with only intended release changes.

## 1. Choose Release Version

Pick a target version (example: `0.1.1`).

Update:

- `CHANGELOG.md` with `## v0.1.1 - YYYY-MM-DD`
- `CHANGELOG.md` entry body following **Changelog Writing Standard**
- `packages/http-client/package.json` (`version`)
- `packages/cli/package.json` (`version` and `@etsysentry/http-client` dependency)

## 2. Build And Prepare

Run from repo root:

```bash
bun install
bun run http-client:build
bun run cli:build
```

## 3. Confirm Scope And Get Publish Approval

Before any npm publish:

- Report that version/changelog updates are complete.
- Ask for explicit publish approval (example: `Do you want me to publish to npm now?`).
- Do not publish until the user confirms.

## 4. Commit And Push Release Changes

After approval, commit all release-version changes and push to `origin/main` before publishing.

```bash
git add CHANGELOG.md packages/http-client/package.json packages/cli/package.json bun.lock
git commit -m "release: vX.Y.Z"
git push origin main
```

## 5. Publish HTTP Client First

Run from `packages/http-client`:

```bash
set -a
source ../../.env
set +a
npm whoami --userconfig ../../.npmrc
npm publish --access public --userconfig ../../.npmrc
```

## 6. Publish CLI

Run from `packages/cli`:

```bash
set -a
source ../../.env
set +a
npm whoami --userconfig ../../.npmrc
npm publish --access public --userconfig ../../.npmrc
```

## 7. Final Validation

Run from repo root:

```bash
bun install
npm view @etsysentry/http-client version --userconfig .npmrc
npm view @etsysentry/cli version --userconfig .npmrc
```

## Fast Failure Handling

- `401 Unauthorized`:
  Load `.env` before publish and use `--userconfig ../../.npmrc`.
- `403 cannot publish over previously published versions`:
  Bump version and retry publish.
- Keep release scope tight:
  Only version files, lockfile, changelog, and required dependency updates.
