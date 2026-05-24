/**
 * Read the advisor pipeline SSE stream until `eventName` appears or timeout.
 */
export async function readSseUntilEvent(
  url: string,
  cookieHeader: string,
  eventName: string,
  timeoutMs = 8_000,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { cookie: cookieHeader },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`SSE request failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes(`event: ${eventName}`)) {
        return buffer;
      }
    }

    throw new Error(`Timed out waiting for SSE event: ${eventName}`);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
