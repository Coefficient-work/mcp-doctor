export type ReplayEvent = {
  step: number;
  type: "assistant" | "tool_call" | "tool_result" | "error";
  summary: string;
  detail?: string;
  toolName?: string;
  isError?: boolean;
  latencyMs?: number;
};

export type FrictionBreakdown = {
  score: number;
  retries: number;
  wrongToolCalls: number;
  unnecessaryCalls: number;
  authRecovery: boolean;
  totalSteps: number;
  reasons: string[];
};

export function computeFriction(
  events: ReplayEvent[],
  succeeded: boolean,
): FrictionBreakdown {
  const toolCalls = events.filter((e) => e.type === "tool_call");
  const errors = events.filter((e) => e.isError || e.type === "error");
  const retries = errors.length;
  const unnecessaryCalls = Math.max(0, toolCalls.length - (succeeded ? 1 : 0));
  const authRecovery = events.some(
    (e) =>
      e.type === "tool_result" &&
      /auth|unauthorized|401|403|token|credential/i.test(e.detail ?? e.summary),
  );

  const reasons: string[] = [];
  if (retries > 0) reasons.push(`${retries} failed tool call(s) / retries`);
  if (unnecessaryCalls > 1) reasons.push(`${unnecessaryCalls} tool calls (may be redundant)`);
  if (authRecovery) reasons.push("auth recovery may have been required");
  if (toolCalls.length > 5) reasons.push("high tool-call count for single task");

  let score = 0;
  score += retries * 2;
  score += unnecessaryCalls * 0.8;
  score += authRecovery ? 2 : 0;
  if (!succeeded) score += 3;
  score = Math.min(10, Math.round(score * 10) / 10);

  return {
    score,
    retries,
    wrongToolCalls: 0,
    unnecessaryCalls,
    authRecovery,
    totalSteps: events.length,
    reasons,
  };
}

export function formatReplayTimeline(events: ReplayEvent[]): string {
  const lines = ["## Replay Timeline", ""];
  if (events.length === 0) {
    lines.push("_No agent steps recorded._");
    return lines.join("\n");
  }
  for (const e of events) {
    const icon =
      e.type === "tool_call" ? "->" :
      e.type === "tool_result" ? "<-" :
      e.type === "error" ? "!!" :
      "..";
    const err = e.isError ? " **ERROR**" : "";
    lines.push(`${e.step}. \`${icon}\` **${e.type}**${err}: ${e.summary}`);
    if (e.detail && e.detail.length < 200) {
      lines.push(`   ${e.detail}`);
    }
  }
  return lines.join("\n");
}

export function formatFrictionReport(friction: FrictionBreakdown, succeeded: boolean): string {
  const lines = [
    "## Agent Friction",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Task succeeded | ${succeeded ? "Yes" : "No"} |`,
    `| Overall friction | **${friction.score} / 10** (lower is better) |`,
    `| Retries / errors | ${friction.retries} |`,
    `| Tool calls | ${friction.unnecessaryCalls} |`,
    `| Auth recovery | ${friction.authRecovery ? "likely" : "no"} |`,
  ];
  if (friction.reasons.length > 0) {
    lines.push("", "**Reasons:**");
    for (const r of friction.reasons) {
      lines.push(`- ${r}`);
    }
  }
  return lines.join("\n");
}
