import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getConfigPath, isValidApiUrl, resolveApiUrl, saveApiUrl } from "../src/config"

let home: string

beforeEach(() => {
  // os.homedir() honors $HOME on POSIX, so pointing HOME at a temp dir isolates the config.
  home = mkdtempSync(join(tmpdir(), "flomo-post-test-"))
  vi.stubEnv("HOME", home)
  vi.stubEnv("FLOMO_API_URL", undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(home, { recursive: true, force: true })
})

describe("isValidApiUrl", () => {
  it("accepts a flomo webhook URL", () => {
    expect(isValidApiUrl("https://flomoapp.com/iwh/abc/def/")).toBe(true)
  })

  it("rejects http, other hosts, and missing path", () => {
    expect(isValidApiUrl("http://flomoapp.com/iwh/abc/def/")).toBe(false)
    expect(isValidApiUrl("https://evil.com/iwh/abc/def/")).toBe(false)
    expect(isValidApiUrl("https://flomoapp.com/iwh/")).toBe(false)
    expect(isValidApiUrl("")).toBe(false)
  })
})

describe("resolveApiUrl", () => {
  it("prefers the FLOMO_API_URL env var", () => {
    vi.stubEnv("FLOMO_API_URL", "https://flomoapp.com/iwh/env/token/")
    // Even with a config file present, env wins.
    const path = getConfigPath()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify({ apiUrl: "https://flomoapp.com/iwh/file/token/" }))

    expect(resolveApiUrl()).toBe("https://flomoapp.com/iwh/env/token/")
  })

  it("falls back to the config file", () => {
    const path = getConfigPath()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify({ apiUrl: "https://flomoapp.com/iwh/file/token/" }))

    expect(resolveApiUrl()).toBe("https://flomoapp.com/iwh/file/token/")
  })

  it("returns null when nothing is configured", () => {
    expect(resolveApiUrl()).toBeNull()
  })

  it("returns null when the config file is malformed", () => {
    const path = getConfigPath()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, "not json")

    expect(resolveApiUrl()).toBeNull()
  })
})

describe("saveApiUrl", () => {
  it("writes the config file with mode 600 and round-trips", () => {
    const url = "https://flomoapp.com/iwh/saved/token/"
    const path = saveApiUrl(url)

    expect(path).toBe(getConfigPath())
    expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(resolveApiUrl()).toBe(url)
  })
})
