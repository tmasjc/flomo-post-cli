# Flomo Post

[![npm](https://img.shields.io/npm/v/flomo-post.svg)](https://www.npmjs.com/package/flomo-post)
[![CI](https://github.com/tmasjc/flomo-post-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/tmasjc/flomo-post-cli/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/flomo-post.svg)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/flomo-post.svg)](LICENSE)

Post notes to [Flomo](https://flomoapp.com) from the command line.

Zero runtime dependencies — a single ~6 kB bundle built on Node's native `fetch`.

## Requirements

- Node.js ≥ 18
- A Flomo account with API access (Pro account) — you need your personal
  incoming-webhook URL, found in Flomo under **Settings → API**. It looks like
  `https://flomoapp.com/iwh/<id>/<token>/`.

## Quick start

```bash
# one-time setup: paste your webhook URL at the prompt
npx flomo-post init

# post a note
npx flomo-post new "Reading notes on CLI design #dev"
```

Tags are just inline `#hashtags` — flomo parses them natively.

## Commands

| Command | Behavior |
|---|---|
| `flomo-post init` | Prompt for your webhook URL, validate it, save to the config file |
| `flomo-post test` | Post `Hello World!` with a timestamp (verifies your setup) |
| `flomo-post new <content...>` | Post the given content |
| `flomo-post --help` | Show usage |
| `flomo-post --version` | Show version |

`new` also reads piped stdin when no arguments are given:

```bash
echo "captured from a pipeline #inbox" | flomo-post new
```

## Configuration

The webhook URL is resolved in precedence order:

1. `FLOMO_API_URL` environment variable
2. `~/.config/flomo-post/config.json` — written by `flomo-post init` with
   file mode `600`

The env var is handy for scripts and CI; `init` is better for interactive
use since the URL never touches your shell history.

**The webhook URL is a secret** — it is the credential for your flomo
account. flomo-post never prints it: error messages redact it to
`https://flomoapp.com/iwh/****`.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Posted successfully |
| `1` | Network or API failure |
| `2` | Usage or configuration error |

Errors go to stderr; normal output to stdout.

## Development

```bash
npm install
npm test            # vitest, fetch always mocked — never hits the network
npm run typecheck   # tsc --noEmit, strict
npm run build       # tsup → dist/cli.js
npm run dev -- new "from source"   # run the CLI via tsx
```

CI runs typecheck, tests, and build on Node 20, 22, and 24, and separately
verifies the bundled CLI still runs on the Node 18 floor declared in `engines`.

## Releasing

Releases publish to npm from GitHub Actions via OIDC trusted publishing — no
tokens are involved. See [docs/RELEASING.md](docs/RELEASING.md).

Every release from `v0.1.1` onward carries a signed provenance attestation
linking the tarball to the commit and workflow run that built it:

```bash
npm audit signatures
```

## License

MIT
