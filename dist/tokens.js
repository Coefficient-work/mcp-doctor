/** Rough token estimate (chars / 4) � good enough for RAT benchmarks. */
export function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
export function toolToMcpPayload(tool) {
    return {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
    };
}
export function toolsTokenCount(tools) {
    const payload = tools.map(toolToMcpPayload);
    return estimateTokens(JSON.stringify(payload));
}
export function perToolTokens(tools) {
    return tools.map((tool) => ({
        name: tool.name,
        tokens: estimateTokens(JSON.stringify(toolToMcpPayload(tool))),
    }));
}
