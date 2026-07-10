import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { generateText, jsonSchema, stepCountIs, tool, type ToolSet } from "ai";
import { callMcpTool, connectMcpSession, type McpSession } from "./mcp-client.js";
import type { McpServerEntry } from "./config.js";
import {
  computeFriction,
  formatFrictionReport,
  formatReplayTimeline,
  type ReplayEvent,
} from "./friction.js";

export type ModelProvider = "openai" | "anthropic" | "gateway";

export type EvalOptions = {
  task: string;
  models?: string[];
  maxSteps?: number;
  timeoutMs?: number;
};

export type ModelEvalResult = {
  model: string;
  provider: ModelProvider;
  succeeded: boolean;
  friction: ReturnType<typeof computeFriction>;
  events: ReplayEvent[];
  finalAnswer?: string;
  error?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
};

export type EvalResult = {
  serverName: string;
  task: string;
  models: ModelEvalResult[];
};

export async function runEval(
  entry: McpServerEntry,
  serverName: string,
  options: EvalOptions,
): Promise<EvalResult> {
  assertGatewayAuth();

  const session = await connectMcpSession(entry, serverName, options.timeoutMs ?? 45_000);
  const models = options.models ?? [defaultModel()];
  const results: ModelEvalResult[] = [];

  try {
    for (const model of models) {
      const gatewayModel = normalizeGatewayModel(model);
      const provider = modelProviderFor(gatewayModel);
      try {
        results.push(
          await runSingleModelEval(
            session,
            gatewayModel,
            provider,
            options.task,
            options.maxSteps ?? 8,
          ),
        );
      } catch (e) {
        results.push({
          model: gatewayModel,
          provider,
          succeeded: false,
          friction: computeFriction([], false),
          events: [],
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } finally {
    await session.close();
  }

  return { serverName, task: options.task, models: results };
}

async function runSingleModelEval(
  session: McpSession,
  model: string,
  provider: ModelProvider,
  task: string,
  maxSteps: number,
): Promise<ModelEvalResult> {
  const events: ReplayEvent[] = [];
  let stepNum = 0;

  events.push({ step: ++stepNum, type: "assistant", summary: `Task: ${task.slice(0, 120)}` });

  const tools = buildAiTools(session);
  const t0 = Date.now();

  const result = await generateText({
    model,
    tools,
    stopWhen: stepCountIs(maxSteps),
    system:
      "You complete tasks using MCP tools. Call tools when needed. Be concise. Stop when the task is done and summarize.",
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
  const succeeded =
    result.finishReason === "stop" &&
    /done|complete|success|here is|result|listed|found|tools?/i.test(finalAnswer ?? "");

  const friction = computeFriction(events, succeeded);

  return {
    model,
    provider,
    succeeded,
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

function buildAiTools(session: McpSession): ToolSet {
  const tools: ToolSet = {};

  for (const mcpTool of session.tools) {
    tools[mcpTool.name] = tool({
      description: mcpTool.description ?? mcpTool.name,
      inputSchema: jsonSchema(mcpInputSchema(mcpTool)),
      execute: async (args: Record<string, unknown>) => {
        const out = await callMcpTool(session, mcpTool.name, args as Record<string, unknown>);
        if (out.isError) return { error: true, text: out.text };
        return out.text;
      },
    });
  }

  return tools;
}

function mcpInputSchema(mcpTool: Tool): Record<string, unknown> {
  const schema = mcpTool.inputSchema;
  if (schema && typeof schema === "object") {
    return schema as Record<string, unknown>;
  }
  return { type: "object", properties: {} };
}

function formatToolOutput(output: unknown): string {
  if (typeof output === "string") return output;
  if (output && typeof output === "object" && "text" in output) {
    return String((output as { text: unknown }).text);
  }
  return JSON.stringify(output);
}

function isToolErrorOutput(output: unknown): boolean {
  return Boolean(
    output &&
      typeof output === "object" &&
      "error" in output &&
      (output as { error?: boolean }).error === true,
  );
}

function assertGatewayAuth(): void {
  if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) return;
  throw new Error(
    "AI_GATEWAY_API_KEY required for eval. Get a free key at https://vercel.com/ai-gateway " +
      "(or run `vercel env pull` for OIDC). Keys stay local ù never stored by mcp-doctor.",
  );
}

function normalizeGatewayModel(model: string): string {
  if (model.includes("/")) return model;
  if (model.startsWith("claude")) return `anthropic/${model}`;
  return `openai/${model}`;
}

function defaultModel(): string {
  return "openai/gpt-4o-mini";
}

function modelProviderFor(model: string): ModelProvider {
  if (model.startsWith("anthropic/")) return "anthropic";
  if (model.startsWith("openai/")) return "openai";
  return "gateway";
}

export function formatModelMatrix(results: ModelEvalResult[]): string {
  const lines = [
    "## Model Compatibility Matrix",
    "",
    "| Model | Success | Friction | Tokens |",
    "|-------|---------|----------|--------|",
  ];
  for (const r of results) {
    const ok = r.error ? "error" : r.succeeded ? "pass" : "fail";
    const tokens = r.usage?.totalTokens ?? "ù";
    lines.push(`| ${r.model} | ${ok} | ${r.friction.score} | ${tokens} |`);
  }
  return lines.join("\n");
}

export function formatEvalReport(result: EvalResult): string {
  const lines = [
    `# Agent Eval: ${result.serverName}`,
    "",
    `**Task:** ${result.task}`,
    "",
    "_Powered by [Vercel AI SDK](https://ai-sdk.dev) + [AI Gateway](https://vercel.com/ai-gateway)_",
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
    lines.push(formatFrictionReport(m.friction, m.succeeded), "");
    lines.push(formatReplayTimeline(m.events), "");
    if (m.finalAnswer) {
      lines.push("**Final answer:**", m.finalAnswer.slice(0, 500), "");
    }
  }

  return lines.join("\n");
}
