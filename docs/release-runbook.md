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

- macOS Keychain contains a valid npm token under
  `rankwrangler-npm-token` for the current `$USER`.
- Repo-root `.npmrc` is configured for npm registry auth.
- You are on the release branch with only intended release changes.

## 1. Choose Release Version

Pick a target version (example: `0.1.1`).

Before writing the release entry, derive changelog scope from git history:

- Find the previous release commit (example: `git log --oneline --grep "release: v"`).
- Build the commit range from previous release to current `HEAD` (example: `prev_release..HEAD`).
- Summarize all user-visible changes in that range into the new changelog entry.
- Exclude internal-only changes with no user-visible impact.

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

## 3. Confirm Scope And Proceed To Publish

Before any npm publish:

- Report that version/changelog updates are complete.
- Confirm the repo is on the intended release state and proceed without an extra approval gate.

## 4. Commit And Push Release Changes

Commit all release-version changes and push to `origin/main` before publishing.

```bash
git add CHANGELOG.md packages/http-client/package.json packages/cli/package.json bun.lock
git commit -m "release: vX.Y.Z"
git push origin main
```

## 5. Publish HTTP Client First

Run from `packages/http-client`:

```bash
export NPM_TOKEN="$(security find-generic-password -a "$USER" -s rankwrangler-npm-token -w)"
npm whoami --userconfig ../../.npmrc
npm publish --access public --userconfig ../../.npmrc
```

## 6. Publish CLI

Run from `packages/cli`:

```bash
export NPM_TOKEN="$(security find-generic-password -a "$USER" -s rankwrangler-npm-token -w)"
npm whoami --userconfig ../../.npmrc
npm publish --access public --userconfig ../../.npmrc
```

## 7. Final Validation

Run from repo root:

```bash
bun install
export NPM_TOKEN="$(security find-generic-password -a "$USER" -s rankwrangler-npm-token -w)"
npm view @etsysentry/http-client version --userconfig .npmrc
npm view @etsysentry/cli version --userconfig .npmrc
```

## Fast Failure Handling

- `401 Unauthorized`:
  Refresh `NPM_TOKEN` from Keychain and use `--userconfig ../../.npmrc`.
- `security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.`:
  Add or update the `rankwrangler-npm-token` item for the current macOS user.
- `403 cannot publish over previously published versions`:
  Bump version and retry publish.
- Keep release scope tight:
  Only version files, lockfile, changelog, and required dependency updates.
