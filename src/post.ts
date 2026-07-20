export interface PostResult {
  ok: boolean
  message: string
}

export function redactUrl(_url: string): string {
  return "https://flomoapp.com/iwh/****"
}

export async function postNote(apiUrl: string, content: string): Promise<PostResult> {
  let res: Response
  try {
    res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, content_type: "markdown" }),
    })
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    // Never leak the secret URL in error output.
    const safe = raw.split(apiUrl).join(redactUrl(apiUrl))
    return { ok: false, message: `Network error: ${safe}` }
  }

  const body = await res.text()
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
