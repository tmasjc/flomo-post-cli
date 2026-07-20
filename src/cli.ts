#!/usr/bin/env node
import { createRequire } from "node:module"
import type { PostResult } from "./post"

const VERSION: string = createRequire(import.meta.url)("../package.json").version

export interface Deps {
  stdout: (line: string) => void
  stderr: (line: string) => void
  isStdinTTY: boolean
  readStdin: () => Promise<string>
  promptForUrl: () => Promise<string>
  post: (apiUrl: string, content: string) => Promise<PostResult>
  resolveApiUrl: () => string | null
  saveApiUrl: (url: string) => string
  isValidApiUrl: (url: string) => boolean
}

const HELP = `flomo-post — post notes to flomo

Usage:
  flomo-post init              Save your webhook URL to the config file
  flomo-post test              Post "Hello World!" with a timestamp
  flomo-post new <content...>  Post content (or pipe it via stdin)
  flomo-post --help            Show this help
  flomo-post --version         Show the version

Configuration (in precedence order):
  FLOMO_API_URL                     Webhook URL (overrides the config file)
  ~/.config/flomo-post/config.json  Written by \`flomo-post init\``

export async function main(argv: string[], deps: Deps): Promise<number> {
  const [command, ...rest] = argv

  if (command === "--help" || command === "-h") {
    deps.stdout(HELP)
    return 0
  }
  if (command === "--version" || command === "-v") {
    deps.stdout(VERSION)
    return 0
  }
  if (command === "init") return runInit(deps)
  if (command === "test") {
    return doPost(deps, `Hello World! ${new Date().toISOString()}`)
  }
  if (command === "new") return runNew(rest, deps)

  deps.stderr(HELP)
  return 2
}

async function runNew(args: string[], deps: Deps): Promise<number> {
  let content = args.join(" ").trim()
  if (!content && !deps.isStdinTTY) {
    content = (await deps.readStdin()).trim()
  }
  if (!content) {
    deps.stderr("Usage: flomo-post new <content...>  (or pipe content via stdin)")
    return 2
  }
  return doPost(deps, content)
}

async function doPost(deps: Deps, content: string): Promise<number> {
  const apiUrl = deps.resolveApiUrl()
  if (!apiUrl) {
    deps.stderr("No API URL configured. Run `flomo-post init` or set FLOMO_API_URL.")
    return 2
  }
  const result = await deps.post(apiUrl, content)
  if (!result.ok) {
    deps.stderr(result.message)
    return 1
  }
  deps.stdout("Posted.")
  return 0
}

async function runInit(deps: Deps): Promise<number> {
  const url = (await deps.promptForUrl()).trim()
  if (!deps.isValidApiUrl(url)) {
    deps.stderr("Invalid URL — expected the shape https://flomoapp.com/iwh/<id>/<token>/")
    return 2
  }
  const path = deps.saveApiUrl(url)
  deps.stdout(`Saved to ${path}`)
  return 0
}
