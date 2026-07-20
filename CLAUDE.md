# AGENTS.md

## Overview

`flomo-post` is a zero-runtime-dependency TypeScript CLI that posts notes to [flomo](https://flomoapp.com) via its incoming-webhook API. Distributed via npm and runnable with `npx flomo-post`.

## API Contract

flomo exposes a per-account webhook URL. The URL itself is the credential — the path contains a unique id and token.

```
POST https://flomoapp.com/iwh/<unique_id>/<token>/
Content-Type: application/json

{"content": "note text with inline #tags", "content_type": "markdown"}
```

- Treat any non-2xx response as failure; print the response body's message to stderr.
- Tags are plain inline `#hashtags` inside `content` — flomo parses them natively; no separate tag field exists.

### Secret handling

The API URL is a secret.

- Never print or log the full URL (redact to `https://flomoapp.com/iwh/****`).
- Never commit it — not in code, fixtures, or examples.
- Tests must never call the real endpoint; always mock `fetch`.

## Configuration

Resolution order for the API URL:

1. `FLOMO_API_URL` environment variable
2. `~/.config/flomo-post/config.json` — `{"apiUrl": "https://flomoapp.com/iwh/..."}`, written by `flomo-post init` with file mode `600`

If neither is set, exit with code 2 and a message telling the user to run `flomo-post init` or set `FLOMO_API_URL`.

## Commands

| Command | Behavior |
|---|---|
| `flomo-post init` | Prompt for the webhook URL, validate it matches `https://flomoapp.com/iwh/...`, save to the config file |
| `flomo-post test` | Post `Hello World! <ISO-8601 timestamp>` |
| `flomo-post new <content...>` | Join all args with spaces and post. If no args and stdin is piped, read content from stdin. Empty content is a usage error |
| `flomo-post --help` / `--version` | Standard output; also shown on unknown commands (help to stderr, exit 2) |

### Exit codes

- `0` — success
- `1` — network or API failure
- `2` — usage or configuration error

All errors go to stderr; normal output to stdout.

## Toolchain

- Node ≥ 18 (use native `fetch` — no HTTP libraries)
- TypeScript, `strict: true`
- **Zero runtime dependencies** — argv parsing is hand-rolled; the command surface is small enough
- Build: `tsup` → `dist/`
- Tests: `vitest`, with `fetch` mocked
- Package: `bin` entry `flomo-post`, publish to npm

## Project Layout

```
src/
  cli.ts      # entry point, argv parsing, command dispatch
  config.ts   # URL resolution (env var → config file), init logic
  post.ts     # request construction + fetch call
```

## Development Commands

- `npm run build` — bundle with tsup
- `npm test` — run vitest
- `npm run dev` — run the CLI from source (e.g. `tsx src/cli.ts`)
