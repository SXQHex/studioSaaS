import { z } from "zod";
import { commands } from "./commands";
import { queries } from "./queries";

function schemaFor(schema: z.ZodType) {
  const { $schema, ...json } = z.toJSONSchema(schema, {
    io: "input",
    unrepresentable: "any",
  });
  return json;
}
const errors = {
  type: "object",
  required: ["ok", "error", "requestId"],
  properties: {
    ok: { const: false },
    error: {
      type: "object",
      required: ["code", "message"],
      properties: { code: { type: "string" }, message: { type: "string" } },
    },
    requestId: { type: "string", format: "uuid" },
  },
};
const success = {
  type: "object",
  required: ["ok", "data", "requestId"],
  properties: {
    ok: { const: true },
    data: {},
    requestId: { type: "string", format: "uuid" },
  },
};
function responses() {
  return Object.fromEntries(
    [200, 400, 401, 403, 404, 405, 409, 413, 415, 422, 500, 503].map((code) => [
      code,
      {
        description: code === 200 ? "Success" : "API error",
        content: {
          "application/json": { schema: code === 200 ? success : errors },
        },
      },
    ]),
  );
}
export function openApiDocument(
  baseUrl = "https://ysplylnwdfwizmuxvcqg.supabase.co/functions/v1/studio-api",
) {
  const paths: Record<string, unknown> = {};
  for (const [name, command] of Object.entries(commands)) {
    paths[`/v1/commands/${name}`] = {
      post: {
        operationId: name.replaceAll(".", "_"),
        tags: [name.split(".")[0]],
        security: [{ supabaseBearer: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: schemaFor(command.schema) },
          },
        },
        responses: responses(),
      },
    };
  }
  for (const [name, query] of Object.entries(queries)) {
    const schema = schemaFor(query.schema) as {
      properties?: Record<string, Record<string, unknown>>;
      required?: string[];
    };
    paths[`/v1/queries/${name}`] = {
      get: {
        operationId: `read_${name.replaceAll(".", "_")}`,
        tags: [name.split(".")[0]],
        security: [{ supabaseBearer: [] }],
        parameters: Object.entries(schema.properties ?? {}).map(
          ([key, value]) => ({
            name: key,
            in: "query",
            required: schema.required?.includes(key) ?? false,
            ...(key === "filters"
              ? { content: { "application/json": { schema: value } } }
              : { schema: value }),
          }),
        ),
        responses: responses(),
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "StudioSaaS Edge API",
      version: "1.0.0",
      description:
        "Shared backend for web, Android, iOS, macOS and Windows. Use a Supabase user access token. CRUD and read RPCs are also available directly through the RLS-protected Data API. Response data is operation-specific; typed native response models require the documented database types.",
    },
    servers: [{ url: baseUrl }],
    paths,
    components: {
      securitySchemes: {
        supabaseBearer: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Supabase JWT",
        },
      },
    },
  };
}
