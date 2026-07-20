import { describe, expect, it, vi } from "vitest"
import { main, readAll, type Deps } from "../src/cli"

const API_URL = "https://flomoapp.com/iwh/abc/token/"

function makeDeps(overrides: Partial<Deps> = {}) {
  const out: string[] = []
  const err: string[] = []
  const deps: Deps = {
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    isStdinTTY: true,
    readStdin: async () => "",
    promptForUrl: async () => "",
    post: vi.fn(async () => ({ ok: true, message: "ok" })),
    resolveApiUrl: () => API_URL,
    saveApiUrl: () => "/home/user/.config/flomo-post/config.json",
    isValidApiUrl: (url) => url.startsWith("https://flomoapp.com/iwh/"),
    ...overrides,
  }
  return { deps, out, err }
}

describe("readAll", () => {
  it("reassembles a multi-byte UTF-8 character split across chunk boundaries", async () => {
    // "你" (U+4F60) encodes to bytes [0xe4, 0xbd, 0xa0]; splitting mid-character
    // and decoding each Buffer independently would yield U+FFFD replacement chars.
    async function* chunks() {
      yield Buffer.from([0xe4])
      yield Buffer.from([0xbd, 0xa0])
    }

    const result = await readAll(chunks())

    expect(result).toBe("你")
    expect(result).not.toContain("�")
  })

  it("handles plain string chunks", async () => {
    async function* chunks() {
      yield "hello "
      yield "world"
    }

    const result = await readAll(chunks())

    expect(result).toBe("hello world")
  })
})

describe("flomo-post new", () => {
  it("joins args and posts them", async () => {
    const { deps, out } = makeDeps()

    const code = await main(["new", "hello", "world", "#tag"], deps)

    expect(code).toBe(0)
    expect(deps.post).toHaveBeenCalledWith(API_URL, "hello world #tag")
    expect(out).toContain("Posted.")
  })

  it("reads piped stdin when no args are given", async () => {
    const { deps } = makeDeps({
      isStdinTTY: false,
      readStdin: async () => "from pipe\n",
    })

    const code = await main(["new"], deps)

    expect(code).toBe(0)
    expect(deps.post).toHaveBeenCalledWith(API_URL, "from pipe")
  })

  it("is a usage error with no args and interactive stdin", async () => {
    const { deps, err } = makeDeps()

    const code = await main(["new"], deps)

    expect(code).toBe(2)
    expect(deps.post).not.toHaveBeenCalled()
    expect(err.join("\n")).toContain("Usage")
  })

  it("is a config error when no URL is configured", async () => {
    const { deps, err } = makeDeps({ resolveApiUrl: () => null })

    const code = await main(["new", "hi"], deps)

    expect(code).toBe(2)
    expect(err.join("\n")).toContain("flomo-post init")
    expect(err.join("\n")).toContain("FLOMO_API_URL")
  })

  it("exits 1 when the post fails, printing the message to stderr", async () => {
    const { deps, err } = makeDeps({
      post: vi.fn(async () => ({ ok: false, message: "API error (HTTP 404): nope" })),
    })

    const code = await main(["new", "hi"], deps)

    expect(code).toBe(1)
    expect(err.join("\n")).toContain("HTTP 404")
  })
})

describe("flomo-post test", () => {
  it("posts Hello World! with an ISO-8601 timestamp", async () => {
    const { deps } = makeDeps()

    const code = await main(["test"], deps)

    expect(code).toBe(0)
    const posted = vi.mocked(deps.post).mock.calls[0][1]
    expect(posted).toMatch(/^Hello World! \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
})

describe("flomo-post init", () => {
  it("validates the prompted URL and saves it", async () => {
    const saveApiUrl = vi.fn(() => "/home/user/.config/flomo-post/config.json")
    const { deps, out } = makeDeps({
      promptForUrl: async () => "  https://flomoapp.com/iwh/new/token/  ",
      saveApiUrl,
    })

    const code = await main(["init"], deps)

    expect(code).toBe(0)
    expect(saveApiUrl).toHaveBeenCalledWith("https://flomoapp.com/iwh/new/token/")
    expect(out.join("\n")).toContain("Saved to /home/user/.config/flomo-post/config.json")
  })

  it("rejects an invalid URL", async () => {
    const saveApiUrl = vi.fn(() => "unused")
    const { deps, err } = makeDeps({
      promptForUrl: async () => "https://evil.com/iwh/x/",
      saveApiUrl,
    })

    const code = await main(["init"], deps)

    expect(code).toBe(2)
    expect(saveApiUrl).not.toHaveBeenCalled()
    expect(err.join("\n")).toContain("Invalid URL")
  })
})

describe("help and version", () => {
  it("--help prints usage to stdout and exits 0", async () => {
    const { deps, out } = makeDeps()
    expect(await main(["--help"], deps)).toBe(0)
    expect(out.join("\n")).toContain("Usage:")
  })

  it("--version prints a semver to stdout and exits 0", async () => {
    const { deps, out } = makeDeps()
    expect(await main(["--version"], deps)).toBe(0)
    expect(out.join("\n")).toMatch(/^\d+\.\d+\.\d+/)
  })

  it("no command prints help to stderr and exits 2", async () => {
    const { deps, err } = makeDeps()
    expect(await main([], deps)).toBe(2)
    expect(err.join("\n")).toContain("Usage:")
  })

  it("unknown command prints help to stderr and exits 2", async () => {
    const { deps, err } = makeDeps()
    expect(await main(["frobnicate"], deps)).toBe(2)
    expect(err.join("\n")).toContain("Usage:")
  })
})
