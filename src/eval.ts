import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { callMcpTool, connectMcpSession, type McpSession } from "./mcp-client.js";
import type { McpServerEntry } from "./config.js";
import {
  computeFriction,
  formatFrictionReport,
  formatReplayTimeline,
  type ReplayEvent,
} from "./friction.js";

export type ModelProvider = "openai" | "anthropic";

export type EvalOptions = {
  task: string;
  models?: string[];
  provider?: ModelProvider;
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
  const session = await connectMcpSession(entry, serverName, options.timeoutMs ?? 45_000);
  const models = options.models ?? [defaultModel(options.provider ?? "openai")];
  const results: ModelEvalResult[] = [];

  try {
    for (const model of models) {
      const provider = options.provider ?? modelProviderFor(model);
      try {
        results.push(
          await runSingleModelEval(session, model, provider, options.task, options.maxSteps ?? 8),
        );
      } catch (e) {
        results.push({
          model,
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
  let step = 0;

  const openAiTools = session.tools.map(mcpToolToOpenAi);
  const messages: OpenAiMessage[] = [
    {
      role: "system",
      content:
        "You complete tasks using MCP tools. Call tools when needed. Be concise. Stop when the task is done and summarize.",
    },
    { role: "user", content: task },
  ];

  events.push({ step: ++step, type: "assistant", summary: `Task: ${task.slice(0, 120)}` });

  let succeeded = false;
  let finalAnswer: string | undefined;

  for (let i = 0; i < maxSteps; i++) {
    const t0 = Date.now();
    const response = await chatCompletion(provider, model, messages, openAiTools);
    const assistantMsg = response.choices[0]?.message;

    if (assistantMsg?.content) {
      events.push({
        step: ++step,
        type: "assistant",
        summary: assistantMsg.content.slice(0, 200),
        latencyMs: Date.now() - t0,
      });
      finalAnswer = assistantMsg.content;
    }

    const toolCalls = assistantMsg?.tool_calls ?? [];
    if (toolCalls.length === 0) {
      succeeded = /done|complete|success|here is|result|listed|found/i.test(assistantMsg?.content ?? "");
      break;
    }

    messages.push(assistantMsg as OpenAiMessage);

    for (const tc of toolCalls) {
      const fn = tc.function;
      const args = JSON.parse(fn.arguments || "{}") as Record<string, unknown>;
      events.push({
        step: ++step,
        type: "tool_call",
        toolName: fn.name,
        summary: `Call ${fn.name}`,
        detail: JSON.stringify(args).slice(0, 150),
      });

      let toolText: string;
      let isError = false;
      try {
        const out = await callMcpTool(session, fn.name, args);
        toolText = out.text;
        isError = out.isError;
      } catch (e) {
        toolText = e instanceof Error ? e.message : String(e);
        isError = true;
      }

      events.push({
        step: ++step,
        type: isError ? "error" : "tool_result",
        toolName: fn.name,
        summary: toolText.slice(0, 120),
        detail: toolText.slice(0, 500),
        isError,
      });

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: toolText.slice(0, 8000),
      });
    }
  }

  const friction = computeFriction(events, succeeded);

  return { model, provider, succeeded, friction, events, finalAnswer };
}

function mcpToolToOpenAi(tool: Tool) {
  return {
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description ?? tool.name,
      parameters: tool.inputSchema ?? { type: "object", properties: {} },
    },
  };
}

type OpenAiMessage = {
  role: string;
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

async function chatCompletion(
  provider: ModelProvider,
  model: string,
  messages: OpenAiMessage[],
  tools: ReturnType<typeof mcpToolToOpenAi>[],
) {
  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY required for eval (BYOK)");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, tools, tool_choice: "auto" }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    return (await res.json()) as {
      choices: Array<{ message: OpenAiMessage }>;
    };
  }

  throw new Error("Anthropic eval not yet implemented — use --provider openai or gpt-4o-mini");
}

function defaultModel(provider: ModelProvider): string {
  return provider === "openai" ? "gpt-4o-mini" : "claude-sonnet-4-20250514";
}

function modelProviderFor(model: string): ModelProvider {
  if (model.startsWith("claude")) return "anthropic";
  return "openai";
}

export function formatModelMatrix(results: ModelEvalResult[]): string {
  const lines = [
    "## Model Compatibility Matrix",
    "",
    "| Model | Success | Friction |",
    "|-------|---------|----------|",
  ];
  for (const r of results) {
    const ok = r.error ? "error" : r.succeeded ? "pass" : "fail";
    lines.push(`| ${r.model} | ${ok} | ${r.friction.score} |`);
  }
  return lines.join("\n");
}

export function formatEvalReport(result: EvalResult): string {
  const lines = [
    `# Agent Eval: ${result.serverName}`,
    "",
    `**Task:** ${result.task}`,
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
