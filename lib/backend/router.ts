import { getCommand } from "./commands";
import type { BackendConfig, BackendContext } from "./context";
import { BackendError } from "./errors";
import { apiResponse, corsHeaders, readJsonBody } from "./http";
import { openApiDocument } from "./openapi";
import { getQuery, queryParameters } from "./queries";

/** Standard Request/Response only: no cookies, React, or Next.js runtime. */
export function createBackendHandler(
  config: BackendConfig,
  authenticate?: (request: Request) => Promise<BackendContext>,
) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    // Both the hosted gateway and `supabase functions serve` retain the slug.
    const path = url.pathname.replace(
      /^\/(?:functions\/v1\/)?studio-api(?=\/|$)/,
      "",
    );
    if (path === "/v1/openapi" && request.method === "GET") {
      try {
        return Response.json(
          openApiDocument(`${config.url}/functions/v1/studio-api`),
          {
            headers: corsHeaders(request, config),
          },
        );
      } catch (error) {
        if (!(error instanceof BackendError)) throw error;
        const requestId = crypto.randomUUID();
        return Response.json(
          {
            ok: false,
            error: { code: error.code, message: error.message },
            requestId,
          },
          {
            status: error.status,
            headers: {
              "Cache-Control": "no-store",
              Vary: "Origin",
              "X-Request-Id": requestId,
            },
          },
        );
      }
    }
    return apiResponse(
      request,
      async (context) => {
        const match = path.match(
          /^\/v1\/(commands|queries)\/([a-z][a-z0-9.-]*)$/,
        );
        if (!match)
          throw new BackendError(404, "NOT_FOUND", "API adresi bulunamadı.");
        const [, kind, name] = match;
        const method = kind === "commands" ? "POST" : "GET";
        if (request.method !== method)
          throw new BackendError(
            405,
            "METHOD_NOT_ALLOWED",
            `${method} gerekli.`,
          );
        return kind === "commands"
          ? getCommand(name).run(context, await readJsonBody(request))
          : getQuery(name).run(context, queryParameters(url));
      },
      config,
      authenticate,
    );
  };
}
