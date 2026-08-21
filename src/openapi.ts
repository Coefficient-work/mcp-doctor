export type OpenApiDocument = {
  openapi?: string;
  info?: { title?: string; version?: string };
  paths?: Record<string, PathItem>;
  tags?: Array<{ name: string; description?: string }>;
};

type PathItem = Record<string, Operation>;

export type Operation = {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Array<Record<string, unknown>>;
  requestBody?: Record<string, unknown>;
  responses?: Record<string, unknown>;
};

export type ApiTool = {
  name: string;
  description: string;
  tag: string;
  method: string;
  path: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  /** True when listTools omitted inputSchema and we filled an empty object. */
  missingInputSchema?: boolean;
  /** Original operations when using group-by-tag discovery. */
  children?: ApiTool[];
};

export async function loadOpenApiFromDoc(doc: OpenApiDocument): Promise<ApiTool[]> {
  return operationsFromDoc(doc);
}

export async function loadOpenApi(filePath: string): Promise<OpenApiDocument> {
  const { loadOpenApi: load } = await import("./load.js");
  return load(filePath);
}

export function operationsFromDoc(doc: OpenApiDocument): ApiTool[] {
  const tools: ApiTool[] = [];
  const paths = doc.paths ?? {};

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isHttpMethod(method) || !operation) continue;
      const op = operation as Operation;
      const tag = op.tags?.[0] ?? "default";
      const name = sanitizeToolName(op.operationId ?? `${method}_${path}`);
      const parts = [op.summary, op.description].filter(Boolean);
      const description = parts.join(" -- ") || `${method.toUpperCase()} ${path}`;

      tools.push({
        name,
        description,
        tag,
        method: method.toUpperCase(),
        path,
        inputSchema: buildInputSchema(op),
        outputSchema: responseSchemaFromOperation(op),
      });
    }
  }

  return tools;
}

function isHttpMethod(method: string): boolean {
  return ["get", "post", "put", "patch", "delete", "head", "options"].includes(
    method.toLowerCase(),
  );
}

function sanitizeToolName(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
}

function buildInputSchema(operation: Operation): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of operation.parameters ?? []) {
    const name = String(param.name ?? "param");
    properties[name] = {
      type: (param.schema as { type?: string })?.type ?? param.type ?? "string",
      description: param.description,
    };
    if (param.required) required.push(name);
  }

  const body = operation.requestBody as
    | { content?: Record<string, { schema?: Record<string, unknown> }> }
    | undefined;
  const jsonSchema = body?.content?.["application/json"]?.schema;
  if (jsonSchema) {
    properties.body = jsonSchema;
    required.push("body");
  }

  return {
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
  };
}

function responseSchemaFromOperation(operation: Operation): Record<string, unknown> | undefined {
  const responses = operation.responses ?? {};
  for (const code of ["200", "201", "default"]) {
    const response = responses[code] as
      | { content?: Record<string, { schema?: Record<string, unknown> }>; schema?: Record<string, unknown> }
      | undefined;
    const json = response?.content?.["application/json"]?.schema;
    if (json) return json;
    if (response?.schema) return response.schema;
  }
  return undefined;
}
