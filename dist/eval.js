import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, jsonSchema, stepCountIs, tool } from "ai";
import { callMcpTool, connectMcpSession } from "./mcp-client.js";
import { computeFriction, formatFrictionReport, formatReplayTimeline, } from "./friction.js";
export async function runEval(entry, serverName, options) {
    assertEvalAuth();
    const session = await connectMcpSession(entry, serverName, options.timeoutMs ?? 45_000);
    const models = options.models ?? [defaultModel()];
    const results = [];
    try {
        for (const model of models) {
            const resolved = resolveEvalModel(model);
            try {
                results.push(await runSingleModelEval(session, resolved, options.task, options.maxSteps ?? 8));
            }
            catch (e) {
                results.push({
                    model: resolved.label,
                    provider: resolved.provider,
                    succeeded: false,
                    executionProven: false,
                    executionProofReason: "No successful tool result: model execution failed.",
                    friction: computeFriction([], false),
                    events: [],
                    error: e instanceof Error ? e.message : String(e),
                });
            }
        }
    }
    finally {
        await session.close();
    }
    return { serverName, task: options.task, models: results };
}
async function runSingleModelEval(session, resolved, task, maxSteps) {
    const events = [];
    let stepNum = 0;
    events.push({ step: ++stepNum, type: "assistant", summary: `Task: ${task.slice(0, 120)}` });
    const tools = buildAiTools(session);
    const t0 = Date.now();
    const result = await generateText({
        model: resolved.model,
        tools,
        stopWhen: stepCountIs(maxSteps),
        system: "You complete tasks using MCP tools. Call tools when needed. Be concise. Stop when the task is done and summarize.",
        prompt: task,
    });
    const latencyMs = Date.now() - t0;
    for (const s of result.steps) {
        if (s.text) {
            events.push({
                step: ++stepNum,
                type: "assistant",
                summary: s.text.slice(0, 200),
                latencyMs: stepNum === 2 ? latencyMs : undefined,
            });
        }
        for (const tc of s.toolCalls) {
            events.push({
                step: ++stepNum,
                type: "tool_call",
                toolName: tc.toolName,
                summary: `Call ${tc.toolName}`,
                detail: JSON.stringify(tc.input).slice(0, 150),
            });
        }
        for (const tr of s.toolResults) {
            const output = formatToolOutput(tr.output);
            const isError = isToolErrorOutput(tr.output);
            events.push({
                step: ++stepNum,
                type: isError ? "error" : "tool_result",
                toolName: tr.toolName,
                summary: output.slice(0, 120),
                detail: output.slice(0, 500),
                isError,
            });
        }
    }
    const finalAnswer = result.text || undefined;
    const executionProof = evalExecutionProof(events);
    const succeeded = executionProof.proven;
    const friction = computeFriction(events, succeeded);
    return {
        model: resolved.label,
        provider: resolved.provider,
        succeeded,
        executionProven: executionProof.proven,
        executionProofReason: executionProof.reason,
        friction,
        events,
        finalAnswer,
        usage: {
            inputTokens: result.usage?.inputTokens,
            outputTokens: result.usage?.outputTokens,
            totalTokens: result.usage?.totalTokens,
        },
    };
}
export function evalTaskSucceeded(opts) {
    // Providers disagree about the finish reason after a completed tool round
    // (for example `stop`, `end`, or `tool-calls`). The observable product truth
    // is whether the model produced a real, non-error MCP result. Never infer
    // success from prose, and never discard a valid result because of metadata.
    return evalExecutionProof(opts.events).proven;
}
export function evalExecutionProof(events) {
    if (events.some((event) => event.type === "tool_result" && !event.isError)) {
        return {
            proven: true,
            reason: "At least one MCP tool returned a non-error result.",
        };
    }
    const calls = events.filter((event) => event.type === "tool_call");
    if (calls.length === 0) {
        return {
            proven: false,
            reason: "No successful tool result: the model made no MCP tool calls.",
        };
    }
    const errors = events.filter((event) => event.type === "error" || event.isError);
    if (errors.length > 0) {
        return {
            proven: false,
            reason: "No successful tool result: every completed MCP tool call returned an error.",
        };
    }
    return {
        proven: false,
        reason: "No successful tool result: MCP tool calls produced no result.",
    };
}
function buildAiTools(session) {
    const tools = {};
    for (const mcpTool of session.tools) {
        tools[mcpTool.name] = tool({
            description: mcpTool.description ?? mcpTool.name,
            inputSchema: jsonSchema(mcpInputSchema(mcpTool)),
            execute: async (args) => {
                const out = await callMcpTool(session, mcpTool.name, args);
                if (out.isError)
                    return { error: true, text: out.text };
                return out.text;
            },
        });
    }
    return tools;
}
function mcpInputSchema(mcpTool) {
    const schema = mcpTool.inputSchema;
    if (schema && typeof schema === "object") {
        return schema;
    }
    return { type: "object", properties: {} };
}
function formatToolOutput(output) {
    if (typeof output === "string")
        return output;
    if (output && typeof output === "object" && "text" in output) {
        return String(output.text);
    }
    return JSON.stringify(output);
}
function isToolErrorOutput(output) {
    return Boolean(output &&
        typeof output === "object" &&
        "error" in output &&
        output.error === true);
}
export function assertEvalAuth() {
    if (process.env.AI_GATEWAY_API_KEY ||
        process.env.VERCEL_OIDC_TOKEN ||
        process.env.OPENAI_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.OPENROUTER_API_KEY ||
        process.env.OLLAMA_HOST) {
        return;
    }
    throw new Error("eval needs a model key. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, AI_GATEWAY_API_KEY, or OLLAMA_HOST. Keys stay local - never stored by mcp-doctor.");
}
function stripProviderPrefix(model, prefixes) {
    for (const prefix of prefixes) {
        if (model.startsWith(prefix))
            return model.slice(prefix.length);
    }
    return model;
}
function createOpenRouterProvider() {
    return createOpenAICompatible({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
    });
}
export function resolveEvalModel(raw) {
    const slug = normalizeModelSlug(raw);
    if (slug.startsWith("ollama/")) {
        const id = stripProviderPrefix(slug, ["ollama/"]);
        const baseURL = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434/v1";
        const ollama = createOpenAICompatible({ name: "ollama", baseURL });
        return { label: slug, provider: "ollama", model: ollama(id) };
    }
    if (slug.startsWith("openrouter/")) {
        if (!process.env.OPENROUTER_API_KEY) {
            throw new Error("OPENROUTER_API_KEY is not set. Keys stay local - never stored by mcp-doctor.");
        }
        const openrouter = createOpenRouterProvider();
        return {
            label: slug,
            provider: "openrouter",
            model: openrouter(stripProviderPrefix(slug, ["openrouter/"])),
        };
    }
    if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) {
        return { label: slug, provider: "gateway", model: slug };
    }
    if (slug.startsWith("anthropic/") || slug.startsWith("claude")) {
        if (process.env.ANTHROPIC_API_KEY) {
            const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
            return {
                label: slug,
                provider: "anthropic",
                model: anthropic(stripProviderPrefix(slug, ["anthropic/"])),
            };
        }
        if (process.env.OPENROUTER_API_KEY) {
            const openrouter = createOpenRouterProvider();
            return { label: slug, provider: "openrouter", model: openrouter(slug) };
        }
        throw new Error("ANTHROPIC_API_KEY or OPENROUTER_API_KEY is required for Anthropic model slugs. Keys stay local - never stored by mcp-doctor.");
    }
    if (process.env.OPENAI_API_KEY) {
        const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
        return {
            label: slug,
            provider: "openai",
            model: openai(stripProviderPrefix(slug, ["openai/"])),
        };
    }
    if (process.env.ANTHROPIC_API_KEY) {
        const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        return {
            label: slug,
            provider: "anthropic",
            model: anthropic(stripProviderPrefix(slug, ["anthropic/"])),
        };
    }
    if (process.env.OPENROUTER_API_KEY) {
        const openrouter = createOpenRouterProvider();
        return {
            label: slug,
            provider: "openrouter",
            model: openrouter(slug),
        };
    }
    if (process.env.OLLAMA_HOST) {
        const ollama = createOpenAICompatible({
            name: "ollama",
            baseURL: process.env.OLLAMA_HOST,
        });
        return { label: slug, provider: "ollama", model: ollama(stripProviderPrefix(slug, ["ollama/"])) };
    }
    throw new Error("eval needs a model key. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, AI_GATEWAY_API_KEY, or OLLAMA_HOST. Keys stay local - never stored by mcp-doctor.");
}
function normalizeModelSlug(model) {
    if (model.includes("/"))
        return model;
    if (model.startsWith("claude"))
        return `anthropic/${model}`;
    if (model.startsWith("llama") || model.startsWith("mistral") || model.startsWith("qwen")) {
        return `ollama/${model}`;
    }
    return `openai/${model}`;
}
function defaultModel() {
    return "openai/gpt-4o-mini";
}
export function formatModelMatrix(results) {
    const lines = [
        "## Model Compatibility Matrix",
        "",
        "| Model | Execution | Friction | Tokens |",
        "|-------|---------|----------|--------|",
    ];
    for (const r of results) {
        const proven = r.executionProven ?? r.succeeded;
        const ok = r.error ? "error" : proven ? "pass" : "fail";
        const tokens = r.usage?.totalTokens ?? "-";
        lines.push(`| ${r.model} | ${ok} | ${r.friction.score} | ${tokens} |`);
    }
    return lines.join("\n");
}
export function formatEvalReport(result) {
    const lines = [
        `# Agent Eval: ${result.serverName}`,
        "",
        `**Task:** ${result.task}`,
        "",
        "_BYOK eval via the Vercel AI SDK. Keys stay on this machine._",
        "",
        formatModelMatrix(result.models),
        "",
    ];
    for (const m of result.models) {
        lines.push(`### ${m.model}`, "");
        if (m.error) {
            lines.push(`Error: ${m.error}`, "");
            continue;
        }
        const proven = m.executionProven ?? m.succeeded;
        const reason = m.executionProofReason ?? (proven
            ? "At least one MCP tool returned a non-error result."
            : "No successful tool result.");
        lines.push(formatFrictionReport(m.friction, proven, reason), "");
        lines.push(formatReplayTimeline(m.events), "");
        if (m.finalAnswer) {
            lines.push("**Final answer:**", m.finalAnswer.slice(0, 500), "");
        }
    }
    return lines.join("\n");
}
