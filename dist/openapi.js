export async function loadOpenApiFromDoc(doc) {
    return operationsFromDoc(doc);
}
export async function loadOpenApi(filePath) {
    const { loadOpenApi: load } = await import("./load.js");
    return load(filePath);
}
export function operationsFromDoc(doc) {
    const tools = [];
    const paths = doc.paths ?? {};
    for (const [path, pathItem] of Object.entries(paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
            if (!isHttpMethod(method) || !operation)
                continue;
            const op = operation;
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
function isHttpMethod(method) {
    return ["get", "post", "put", "patch", "delete", "head", "options"].includes(method.toLowerCase());
}
function sanitizeToolName(raw) {
    return raw
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 64);
}
function buildInputSchema(operation) {
    const properties = {};
    const required = [];
    for (const param of operation.parameters ?? []) {
        const name = String(param.name ?? "param");
        properties[name] = {
            type: param.schema?.type ?? param.type ?? "string",
            description: param.description,
        };
        if (param.required)
            required.push(name);
    }
    const body = operation.requestBody;
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
function responseSchemaFromOperation(operation) {
    const responses = operation.responses ?? {};
    for (const code of ["200", "201", "default"]) {
        const response = responses[code];
        const json = response?.content?.["application/json"]?.schema;
        if (json)
            return json;
        if (response?.schema)
            return response.schema;
    }
    return undefined;
}
