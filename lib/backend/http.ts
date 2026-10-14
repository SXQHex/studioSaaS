import { authenticateBearer } from "./auth";
import type { BackendConfig, BackendContext } from "./context";
import { BackendError } from "./errors";
export const MAX_API_BODY_BYTES = 65536;
export function corsHeaders(request: Request, config: BackendConfig) {
  const origin = request.headers.get("origin");
  const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
  if (!origin) return headers;
  const allowed = new Set([
    new URL(request.url).origin,
    ...(config.allowedOrigins ?? []),
  ]);
  if (!allowed.has(origin))
    throw new BackendError(
      403,
      "ORIGIN_NOT_ALLOWED",
      "Bu origin için API erişimi tanımlı değil.",
    );
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Expose-Headers", "X-Request-Id");
  headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, apikey, x-client-info",
  );
  return headers;
}
export async function readJsonBody(request: Request) {
  if (
    !/^application\/json(?:\s*;|$)/i.test(
      request.headers.get("content-type") ?? "",
    )
  )
    throw new BackendError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "application/json gerekli.",
    );
  if (Number(request.headers.get("content-length") ?? 0) > MAX_API_BODY_BYTES)
    throw new BackendError(
      413,
      "PAYLOAD_TOO_LARGE",
      "İstek gövdesi çok büyük.",
    );
  const reader = request.body?.getReader();
  if (!reader)
    throw new BackendError(400, "INVALID_JSON", "JSON gövdesi gerekli.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_API_BODY_BYTES) {
        await reader.cancel();
        throw new BackendError(
          413,
          "PAYLOAD_TOO_LARGE",
          "İstek gövdesi çok büyük.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new BackendError(400, "INVALID_JSON", "Geçerli JSON gönderin.");
  }
}
export async function apiResponse(
  request: Request,
  run: (ctx: BackendContext) => Promise<unknown>,
  config: BackendConfig,
  authenticate = (request: Request) => authenticateBearer(request, config),
) {
  const requestId = crypto.randomUUID();
  let headers = new Headers({
    "Cache-Control": "no-store",
    Vary: "Origin",
    "X-Request-Id": requestId,
  });
  try {
    headers = corsHeaders(request, config);
    headers.set("X-Request-Id", requestId);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    const context = await authenticate(request);
    const result = await run(context);
    if (
      result &&
      typeof result === "object" &&
      "ok" in result &&
      result.ok === false &&
      "error" in result &&
      typeof result.error === "string"
    ) {
      const failure = result as {
        error: string;
        status?: number;
        code?: string;
      };
      throw new BackendError(
        failure.status ?? 422,
        failure.code ?? "COMMAND_REJECTED",
        failure.error,
      );
    }
    return Response.json({ ok: true, data: result, requestId }, { headers });
  } catch (error) {
    const known =
      error instanceof BackendError
        ? error
        : new BackendError(500, "INTERNAL_ERROR", "İşlem tamamlanamadı.");
    if (known.status === 401) headers.set("WWW-Authenticate", "Bearer");
    return Response.json(
      {
        ok: false,
        error: { code: known.code, message: known.message },
        requestId,
      },
      { status: known.status, headers },
    );
  }
}
