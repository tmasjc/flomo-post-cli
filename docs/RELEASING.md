# Releasing

`flomo-post` publishes to npm from GitHub Actions using **OIDC trusted
publishing**. There is no npm token anywhere — not in the repo secrets, not on
a developer machine, not in CI. This is deliberate and is the single most
important thing to understand before touching the release path.

## Cutting a release

```bash
npm version patch      # or minor / major — creates the commit and the v* tag
git push
git push --tags        # this fires the release
```

That is the whole procedure. `npm version` writes the new version to
`package.json`, commits it, and creates a matching `v<version>` tag, so the
workflow's tag/version guard passes by construction.

Pushing the tag triggers `.github/workflows/release.yml`, which:

1. Checks out the tagged commit
2. Installs Node 22 and upgrades npm (see [npm version floor](#npm-version-floor))
3. Runs `npm ci`
4. **Verifies the tag matches `package.json`** — a `v0.2.0` tag against a
   `0.1.9` package.json fails here, before anything is published
5. Runs `npm run typecheck`
6. Runs `npm test`
7. Runs `npm publish`

Publishing is the last step, so a failing typecheck or test can never produce a
release. Nothing is published if any earlier step fails.

Watch the run:

```bash
gh run list --workflow=Release --limit 3
gh run watch <run-id> --exit-status
```

## How authentication works

The workflow declares `permissions: id-token: write`. GitHub mints a
short-lived OIDC token describing exactly which repository, workflow, and ref
is running. npm exchanges that for publish rights, having been told in advance
which workflow to trust.

The trusted publisher is configured on npmjs.com under the package's settings:

| Field | Value |
|---|---|
| Provider | GitHub Actions |
| Owner | `tmasjc` |
| Repository | `flomo-post-cli` |
| Workflow filename | `release.yml` |
| Environment | *(blank)* |

Two consequences worth internalising:

- **Renaming `release.yml` breaks publishing.** The filename is part of the
  trust configuration. If you rename or move it, update the trusted publisher
  on npmjs.com in the same change.
- **Forks cannot publish.** The OIDC claim names this repository. A fork's
  token will not be accepted, regardless of what secrets its owner sets.

### Publishing access setting

The package is set to **"Require two-factor authentication and disallow
tokens"**. No npm token of any type can publish this package. The only two
routes to the registry are the tagged workflow above, and a human typing a
one-time password locally.

This is compatible with trusted publishing by design — npm treats OIDC as
separate from the token policy.

### Provenance

Trusted publishing generates and signs a provenance attestation
**automatically**. Do not add `--provenance` to the publish command; it is
redundant under OIDC, and the flag exists for the token-based flow that this
project no longer uses.

Provenance links each published tarball to the exact commit and workflow run
that built it, and the attestation is recorded in a public transparency log.
For a tool whose entire configuration is a credential, that verifiable build
chain is worth having.

`v0.1.0` is the one exception — it was published by hand to bootstrap the
package (see [Bootstrapping](#bootstrapping-a-new-package)) and carries no
provenance. Every version from `v0.1.1` onward does.

## npm version floor

`actions/setup-node` with `node-version: 22` installs npm **10.x**. Trusted
publishing requires npm **>= 11.5.1**. The workflow therefore runs:

```yaml
- run: npm install -g npm@latest
```

before publishing. **Do not remove this step.** Without it the publish fails
with an authentication error that gives no hint that the npm version is the
cause. Node itself must be >= 22.14.0, which `node-version: 22` satisfies.

If you ever add staged publishing (below), the floor rises to npm >= 11.15.0.

## Troubleshooting

### `npm error code EOTP` — "requires a one-time password"

A token is being used instead of OIDC. Check, in order:

1. Does the workflow still have `permissions: id-token: write`?
2. Is a `NODE_AUTH_TOKEN` / `NPM_TOKEN` set anywhere? There should be none.
3. Is the trusted publisher on npmjs.com still pointing at `release.yml`?
4. Did the `npm install -g npm@latest` step run?

**Do not fix this by creating a token.** See [Why there is no
token](#why-there-is-no-token).

### `Tag vX.Y.Z does not match package.json version`

The guard did its job. Either the tag was created by hand without bumping
`package.json`, or the bump was never committed. Delete the tag, fix the
version, re-tag:

```bash
git tag -d v0.2.0 && git push origin :refs/tags/v0.2.0
npm version minor
git push && git push --tags
```

### `404 Not Found` on publish

The package does not exist on the registry, or the trusted publisher is
configured against a different package name. OIDC cannot create a package that
has never been published — see below.

### The release run is red but the version published anyway

Not possible with the current step order: `npm publish` is last. If the run
fails, check *which* step failed before assuming a partial publish. Verify with
`npm view flomo-post versions`.

## Bootstrapping a new package

**Neither trusted publishing nor staged publishing can create a package that
has never been published.** npmjs.com requires the package to exist before its
trusted-publisher settings can be configured, and staged publishing explicitly
rejects brand-new packages. This is a known npm limitation, not a
misconfiguration.

This only matters if the package is ever renamed or moved to a scope. In that
case, bootstrap by hand from a developer machine:

```bash
npm login
npm publish          # prepublishOnly runs tests and build first; enter the OTP
```

Then configure the trusted publisher on npmjs.com, set publishing access to
disallow tokens, and every subsequent release goes through CI as normal.

The bootstrap version will not carry provenance — local publishes cannot
generate it. Accept that for one version rather than creating a token to avoid
it.

## Why there is no token

npm is retiring long-lived publish credentials, and the instinct to "just add a
token" when a release fails will make things worse, not better:

- **Classic tokens** (including Automation tokens) are deprecated.
- **Granular access tokens with bypass-2FA** lose the ability to perform
  sensitive account operations in **early August 2026**, and lose publishing
  entirely around **January 2027**.

npm's recommended path is trusted publishing (OIDC) or staged publishing with a
human approval step. This project uses the former.

If the release pipeline breaks and you need to ship urgently, the correct
fallback is a **local publish with a one-time password**, not a token:

```bash
npm login
npm publish
```

That version will lack provenance, which is a reasonable trade for an urgent
fix. Repair the OIDC path afterwards rather than leaving the manual route as
the norm.

## Optional: staged publishing

For a higher bar, CI can stage a release that a human then approves with 2FA:

```bash
npm stage publish        # from CI, via OIDC — no 2FA required
npm stage list           # locally
npm stage approve <id>   # requires 2FA — proof of presence
```

Requires npm >= 11.15.0. This adds a manual gate to every release, which is
probably overkill for a single-maintainer package, but is worth reaching for if
the package ever gains meaningful install numbers.

## What gets published

The tarball is deliberately small — `files: ["dist"]` in `package.json`, plus
the three files npm always includes:

```
LICENSE          1.1 kB
README.md        2.1 kB
dist/cli.js      5.7 kB
package.json     1.1 kB
```

Roughly 4.3 kB packed. Verify before releasing with:

```bash
npm run build && npm pack --dry-run
```

Note that `package.json` **must** stay in the tarball: `src/cli.ts` resolves
`--version` by requiring `../package.json` relative to `dist/cli.js`. npm
always includes it regardless of the `files` field, but do not "optimise" it
away with an `.npmignore`.

## Reference

- [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/)
- [npm staged publishing](https://docs.npmjs.com/staged-publishing/)
- [OIDC trusted publishing GA announcement](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/)
- [GAT bypass-2FA deprecation](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/)
