import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

export function getConfigPath(): string {
  return join(homedir(), ".config", "flomo-post", "config.json")
}

export function isValidApiUrl(url: string): boolean {
  return /^https:\/\/flomoapp\.com\/iwh\/.+/.test(url)
}

export function resolveApiUrl(): string | null {
  const envUrl = process.env.FLOMO_API_URL
  if (envUrl) return envUrl
  try {
    const raw = readFileSync(getConfigPath(), "utf8")
    const parsed = JSON.parse(raw) as { apiUrl?: string }
    return parsed.apiUrl ?? null
  } catch {
    return null
  }
}

export function saveApiUrl(url: string): string {
  const path = getConfigPath()
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  writeFileSync(path, JSON.stringify({ apiUrl: url }, null, 2) + "\n", { mode: 0o600 })
  chmodSync(path, 0o600) // writeFileSync mode only applies on create; enforce on overwrite too
  return path
}
