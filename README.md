# Flomo Post

Post notes to [Flomo](https://flomoapp.com) from the command line.

Zero runtime dependencies — a single small binary built on Node's native `fetch`.

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

## License

MIT
