export function parseListToolsSchemaIssue(raw) {
    const indexMatch = raw.match(/tools\[(\d+)\]/i) ||
        raw.match(/tools\.(\d+)/i) ||
        raw.match(/"tools"\s*,\s*(\d+)/i);
    const expected = raw.match(/expected[:\s]+["']?(\w+)/i)?.[1];
    const received = raw.match(/received[:\s]+["']?(\w+)/i)?.[1];
    return {
        index: indexMatch ? Number(indexMatch[1]) : undefined,
        expected: expected?.toLowerCase(),
        received: received?.toLowerCase(),
    };
}
export function humanizeListToolsError(raw, tools = []) {
    const trimmed = raw.replace(/^listTools:\s*/i, "").trim();
    if (/is missing required inputSchema/i.test(trimmed) && /Server may still be reachable/i.test(trimmed)) {
        return trimmed;
    }
    const issue = parseListToolsSchemaIssue(raw);
    const schemaIssue = /inputSchema/i.test(raw) || issue.index !== undefined;
    if (schemaIssue) {
        const idx = issue.index;
        const named = idx !== undefined ? tools[idx]?.name : undefined;
        const who = named && named.length > 0
            ? `Tool #${idx} (\`${named}\`)`
            : idx !== undefined
                ? `Tool #${idx}`
                : "A tool";
        const expected = issue.expected ?? "object";
        const received = issue.received ?? "undefined";
        return `${who} is missing required inputSchema (expected ${expected}, got ${received}). Server may still be reachable.`;
    }
    const msg = raw.replace(/^listTools:\s*/i, "").trim();
    if (!msg) {
        return "Tool discovery failed. Server may still be reachable.";
    }
    if (msg.length > 180 || msg.startsWith("{") || msg.startsWith("[")) {
        return "Tool discovery failed while validating listTools (invalid tool schema). Server may still be reachable.";
    }
    return `Tool discovery failed: ${msg}. Server may still be reachable.`;
}
export function coerceListedTools(rawTools) {
    const tools = [];
    const malformed = [];
    rawTools.forEach((raw, index) => {
        const obj = raw && typeof raw === "object" ? raw : {};
        const name = typeof obj.name === "string" && obj.name ? obj.name : `tool index ${index}`;
        const missing = obj.inputSchema == null || typeof obj.inputSchema !== "object";
        if (missing)
            malformed.push({ index, name });
        tools.push({
            name,
            description: typeof obj.description === "string" ? obj.description : "",
            inputSchema: missing
                ? { type: "object", properties: {} }
                : obj.inputSchema,
            ...(obj.outputSchema && typeof obj.outputSchema === "object"
                ? { outputSchema: obj.outputSchema }
                : {}),
        });
    });
    return { tools, malformed };
}
export const lenientListToolsResultSchema = {
    safeParse(data) {
        if (!data || typeof data !== "object") {
            return { success: false, error: new Error("listTools result is not an object") };
        }
        const tools = data.tools;
        if (!Array.isArray(tools)) {
            return { success: false, error: new Error("listTools result has no tools array") };
        }
        return { success: true, data: { tools } };
    },
};
