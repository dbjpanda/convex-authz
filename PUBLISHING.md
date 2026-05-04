# Publishing

Releases for `@djpanda/convex-authz` are **fully automated**. You do not run
`npm publish`, you do not bump the version, you do not edit the changelog, and
you do not need an npm token. Merging a Conventional Commit PR into `main` is
the entire interface.

This document explains how the pipeline works, what your responsibilities are,
and how to recover when something goes wrong.

## TL;DR

```
dev branch  →  PR to main (Conventional Commit title)  →  squash merge
            →  release-please opens a "release PR" on main
            →  squash merge that release PR
            →  tag + GitHub Release + npm publish (via OIDC)
```

You touch only the first two arrows. The rest is automatic.

## The release flow in detail

### 1. Develop on `dev`

Push freely to `dev`. No release machinery fires on `dev` pushes — only PRs
trigger CI (`test.yml`).

### 2. Open a PR from `dev` to `main`

The **PR title must follow Conventional Commits**. This is enforced by
`.github/workflows/lint-pr-title.yml` and is non-negotiable: the PR title
becomes the squash-merge commit message on `main`, and that message is what
release-please reads to compute the next version.

Allowed types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`,
`ci`, `chore`.

| PR title example | Effect on next version |
| --- | --- |
| `fix: handle empty scope in checkPermission` | patch bump (e.g. `2.2.0` → `2.2.1`) |
| `feat: add caveat support to ABAC policies` | minor bump (`2.2.0` → `2.3.0`) |
| `feat!: rename Authz.can() → Authz.check()` | major bump (`2.2.0` → `3.0.0`) |
| `fix!: change return shape of getUserRoles` | major bump |
| `chore: bump deps`, `ci: pin action versions` | no version bump |
| `docs: clarify ReBAC traversal` | no version bump (hidden in changelog) |

The `!` after the type is the breaking-change signal. You can also include a
`BREAKING CHANGE:` footer in the PR body for the same effect.

While the PR is open, `test.yml` runs `npx pkg-pr-new publish` on every push,
which posts a comment with a try-before-merge install URL:

```sh
npm install https://pkg.pr.new/dbjpanda/convex-authz@<sha>
```

Useful for sanity-checking the change in a downstream project before merging.

### 3. Squash-merge the PR

Always **squash merge** PRs into `main`. This collapses your commits into a
single commit whose message is the PR title — preserving the Conventional
Commit contract that release-please depends on.

The squash merge to `main` triggers `release-please.yml`, which:

- Reads commits since the last release tag
- Computes the next version from the commit types
- Opens (or updates) a **release PR** on `main` titled
  `chore(main): release convex-authz X.Y.Z`
- That PR contains the `package.json` bump, the `.release-please-manifest.json`
  bump, and the regenerated `CHANGELOG.md` section

The release PR stays open and continuously updates as you merge more PRs into
`main`. Nothing is published yet.

### 4. Merge the release PR when you want to ship

When you are ready to release, squash-merge the release PR. This re-runs
`release-please.yml`, which this time:

- Creates the git tag (e.g. `v2.3.0`)
- Creates the GitHub Release with auto-generated notes
- Sets `release_created: true`, which triggers the `publish` job
- The `publish` job checks out the tag, builds, and runs
  `npm publish --provenance --access public`
- Authentication is via **GitHub Actions OIDC**, validated against the
  trusted publisher configured on npm. No tokens involved.

Within ~1 minute of merging, the new version is on npm with provenance
attestation linking the tarball back to the exact commit and workflow run.

## What you must NOT do

- Do **not** edit `package.json` `version` manually. release-please owns it.
- Do **not** edit `CHANGELOG.md` directly. release-please regenerates it.
- Do **not** push directly to `main`. You'd skip PR title linting and could
  break release-please's commit parsing.
- Do **not** create tags manually. release-please creates them.
- Do **not** run `npm publish` from your laptop. There is no token, and a
  manual publish would skip the provenance attestation chain.
- Do **not** add a long-lived `NPM_TOKEN` secret back to the repo. The
  Trusted Publisher is the auth mechanism now; a token would be a downgrade.

## Configuration reference

### Release-please

- Config: `release-please-config.json` (single package, `@djpanda/convex-authz`)
- State: `.release-please-manifest.json` (current version)
- Workflow: `.github/workflows/release-please.yml` (triggers on push to `main`)

Tag format is `v<major>.<minor>.<patch>` (e.g. `v2.3.0`). The component name
is intentionally omitted from the tag (`include-component-in-tag: false`)
because this repo ships exactly one package.

### npm Trusted Publisher

The npm package is configured to trust this repo's release-please workflow
via OpenID Connect. To inspect or modify:

1. Go to https://www.npmjs.com/package/@djpanda/convex-authz/access
2. The **Trusted Publisher** section shows:
   - Repository: `dbjpanda/convex-authz`
   - Workflow: `release-please.yml`
   - Environment: *(none)*
3. The **Publishing access** setting can stay on
   "Require two-factor authentication and disallow tokens (recommended)" —
   trusted publishers bypass this restriction by design.

### Workflow permissions

The `publish` job in `release-please.yml` declares:

```yaml
permissions:
  contents: read
  id-token: write   # required for npm OIDC + provenance
```

`id-token: write` is the GitHub-side half of OIDC. Removing it would break
publishing immediately.

## Configuration migration: changing the tag pattern

Changing the `include-component-in-tag` (or any other tag-shape) field in
`release-please-config.json` is **retroactive**: release-please's "what was
the last release" lookup is a tag-pattern scan, not a manifest read. Old
tags created under the previous pattern stop matching the new pattern and
become invisible to release-please.

When that happens, release-please falls back to the highest tag that still
matches the new pattern, treats every commit since then as unreleased, and
opens a release PR that re-includes commits from already-shipped versions
(usually with duplicated `feat:` entries — that is the giveaway).

**If you change the tag pattern, you must backfill matching tags for the
current and recent release(s).** Example (tag-prefix drop, as done in
PR #29):

```sh
# The old tag was convex-authz-vX.Y.Z, the new pattern is vX.Y.Z.
# Backfill v2.2.0 pointing at the same commit as the legacy tag.
git tag v2.2.0 "$(git rev-parse convex-authz-v2.2.0)"
git push origin v2.2.0
```

If you skip this step and merge anything to `main`, release-please will
open a wrong-version release PR. Do not merge that PR — instead, backfill
the tag, re-run the release-please workflow, and **manually close** the
stale PR (release-please does not auto-close PRs it has already created
when conditions change).

Leave the legacy tag in place. It costs nothing and may be referenced by
external systems (npm provenance verification, blog posts, archive
crawlers).

## Emergency: manual publish (break-glass only)

Only use this if OIDC is broken (e.g. npm trusted publishing outage) AND a
release must ship right now.

1. Generate a short-lived **classic Automation token** at
   https://www.npmjs.com/settings/dbjpanda/tokens (Automation type bypasses
   the package's 2FA-required setting).
2. From a clean checkout of the release tag:
   ```sh
   git checkout v<X.Y.Z>
   npm ci
   npm run build
   NODE_AUTH_TOKEN=<token> npm publish --provenance --access public
   ```
3. **Immediately delete the token** at the same npm settings page.
4. Open an issue capturing why OIDC failed so the next maintainer knows.

Note: a manual publish from a developer machine cannot generate the same
provenance attestation as the GitHub Actions OIDC flow. Downstream consumers
verifying provenance will see a different signer. Treat this as a last
resort, not a routine fallback.

## Recovering from a failed publish

If a release PR merges, the tag and GitHub Release are created, but the npm
`publish` job fails:

1. Diagnose the failure:
   ```sh
   gh run list --workflow=release-please.yml --limit 5
   gh run view <run-id> --log-failed
   ```
2. Fix the underlying cause (e.g. flaky test, dependency issue, registry
   auth misconfiguration).
3. Re-run only the failed job — do **not** cherry-pick or bump to `X.Y.Z+1`:
   ```sh
   gh run rerun <run-id> --failed
   ```
4. Confirm the package is on npm:
   ```sh
   curl -s https://registry.npmjs.org/@djpanda/convex-authz \
     | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['dist-tags'])"
   ```

The git tag and GitHub Release already point to the correct commit; re-running
the publish job preserves provenance integrity. Bumping the version to "force
a re-release" would create misleading git history and is not necessary.

## Verifying a published release

After any publish, sanity-check the alignment:

```sh
# 1. npm latest
curl -s https://registry.npmjs.org/@djpanda/convex-authz \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['dist-tags'])"

# 2. Latest GitHub Release
gh release list --limit 1

# 3. Latest git tag
git describe --tags --abbrev=0
```

All three should report the same version. If they diverge, see "Recovering
from a failed publish" above.
