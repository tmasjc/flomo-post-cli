export interface PostResult {
  ok: boolean
  message: string
}

export function redactUrl(_url: string): string {
  return "https://flomoapp.com/iwh/****"
}

export async function postNote(apiUrl: string, content: string): Promise<PostResult> {
  // Never leak the secret URL in error output — applied to any message that
  // might embed it, including nested `cause` details from undici failures.
  const redact = (s: string) => s.split(apiUrl).join(redactUrl(apiUrl))

  let res: Response
  try {
    res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, content_type: "markdown" }),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // undici wraps the real reason (ECONNREFUSED, DNS, TLS) in err.cause;
    // surface it so failures are actionable instead of a bare "fetch failed".
    const cause = err instanceof Error && err.cause instanceof Error ? `: ${err.cause.message}` : ""
    return { ok: false, message: `Network error: ${redact(msg + cause)}` }
  }

  let body: string
  try {
    body = await res.text()
  } catch (err) {
    // The connection can die between headers and body; postNote must never
    // reject, so this is reported the same way as a pre-response failure.
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `Network error: ${redact(msg)}` }
  }
  let message = body
  try {
    const parsed = JSON.parse(body) as { message?: string }
    if (parsed.message) message = parsed.message
  } catch {
    // keep raw body
  }

  if (!res.ok) {
    return { ok: false, message: `API error (HTTP ${res.status}): ${message}` }
  }
  return { ok: true, message }
}
