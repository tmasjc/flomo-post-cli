import { afterEach, describe, expect, it, vi } from "vitest"
import { postNote, redactUrl } from "../src/post"

const URL = "https://flomoapp.com/iwh/abc123/secret456/"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("redactUrl", () => {
  it("hides everything after /iwh/", () => {
    expect(redactUrl(URL)).toBe("https://flomoapp.com/iwh/****")
  })
})

describe("postNote", () => {
  it("POSTs content as markdown JSON and succeeds on 2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"code":0,"message":"memo created"}', { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await postNote(URL, "hello #tag")

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "hello #tag", content_type: "markdown" }),
    })
  })

  it("fails on non-2xx with the response body's message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"message":"invalid webhook"}', { status: 404 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await postNote(URL, "hello")

    expect(result.ok).toBe(false)
    expect(result.message).toContain("404")
    expect(result.message).toContain("invalid webhook")
  })

  it("falls back to raw body when the failure body is not JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Bad Gateway", { status: 502 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await postNote(URL, "hello")

    expect(result.ok).toBe(false)
    expect(result.message).toContain("Bad Gateway")
  })

  it("reports network errors without leaking the secret URL", async () => {
    const fetchMock = vi.fn().mockRejectedValue(
      new TypeError(`fetch failed: ${URL}`),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await postNote(URL, "hello")

    expect(result.ok).toBe(false)
    expect(result.message).not.toContain("secret456")
    expect(result.message).toContain("https://flomoapp.com/iwh/****")
  })

  it("includes the cause's message for undici-style fetch failures", async () => {
    const fetchMock = vi.fn().mockRejectedValue(
      new TypeError("fetch failed", { cause: new Error("connect ECONNREFUSED 127.0.0.1:443") }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await postNote(URL, "hello")

    expect(result.ok).toBe(false)
    expect(result.message).toContain("ECONNREFUSED")
  })

  it("redacts the secret URL even when it is embedded in the cause message", async () => {
    const fetchMock = vi.fn().mockRejectedValue(
      new TypeError("fetch failed", { cause: new Error(`connect failed for ${URL}`) }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await postNote(URL, "hello")

    expect(result.ok).toBe(false)
    expect(result.message).not.toContain("secret456")
    expect(result.message).toContain("https://flomoapp.com/iwh/****")
  })

  it("resolves (does not reject) when res.text() fails, redacting the message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.reject(new Error("terminated")),
    } as unknown as Response)
    vi.stubGlobal("fetch", fetchMock)

    const result = await postNote(URL, "hello")

    expect(result.ok).toBe(false)
    expect(result.message).toContain("terminated")
  })
})
