/** Return a JSON response fixture. */
export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Read a case-insensitive header value from HeadersInit. */
export function headerValue(
  headers: HeadersInit | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const normalized = new Headers(headers).get(name);
  return normalized ?? undefined;
}

/** Parse a request body when it is JSON or URL-encoded. */
export function requestBody(init: RequestInit | undefined): any {
  if (!init?.body) return undefined;
  const text = String(init.body);
  try {
    return JSON.parse(text);
  } catch {
    return Object.fromEntries(new URLSearchParams(text));
  }
}
