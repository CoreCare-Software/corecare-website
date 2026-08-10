const JSON_CONTENT_TYPE = /^(?:application\/json|[^;]+\+json)(?:;|$)/i;
const FORM_CONTENT_TYPE = /^application\/x-www-form-urlencoded(?:;|$)/i;

export type JsonObject = Record<string, unknown>;

type JsonBodyResult<T extends JsonObject> =
  | { ok: true; value: T }
  | { ok: false; response: Response };

function failure(message: string, status: number): JsonBodyResult<never> {
  return {
    ok: false,
    response: Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } }),
  };
}

export async function readJsonObject<T extends JsonObject = JsonObject>(request: Request, maxBytes = 65_536): Promise<JsonBodyResult<T>> {
  const contentType = request.headers.get("content-type") || "";
  const isJson = JSON_CONTENT_TYPE.test(contentType);
  const isForm = FORM_CONTENT_TYPE.test(contentType);
  if (!isJson && !isForm) return failure("Submit this request as JSON or a standard form.", 415);

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return failure("This request is too large.", 413);
  if (!request.body) return failure("The request body is empty.", 400);

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("request body limit exceeded");
        return failure("This request is too large.", 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } catch {
    return failure("The request body could not be read.", 400);
  }

  if (isForm) {
    const form = Object.fromEntries(new URLSearchParams(raw));
    if (!form.turnstileToken && form["cf-turnstile-response"]) form.turnstileToken = form["cf-turnstile-response"];
    return { ok: true, value: form as T };
  }

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return failure("The JSON request body must be an object.", 400);
    return { ok: true, value: value as T };
  } catch {
    return failure("The request body contains invalid JSON.", 400);
  }
}
