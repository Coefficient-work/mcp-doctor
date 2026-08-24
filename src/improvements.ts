import type { ScorecardCheck } from "./scorecard.js";
import type { ApiTool } from "./openapi.js";
import { estimateTokens } from "./tokens.js";

export type SuggestedFix = {
  checkId: string;
  problem: string;
  current?: string;
  suggested: string;
};

export function suggestedFixesFromChecks(checks: ScorecardCheck[], tools: ApiTool[]): SuggestedFix[] {
  const fixes: SuggestedFix[] = [];

  for (const check of checks) {
    if (check.severity === "pass" || check.severity === "info") continue;

    if (check.id === "descriptions" || check.id === "ambiguous-names") {
      const thin = tools.filter((t) => !t.description || t.description.length < 40).slice(0, 5);
      for (const tool of thin) {
        fixes.push({
          checkId: check.id,
          problem: `Thin description on \`${tool.name}\``,
          current: tool.description || "(empty)",
          suggested: expandDescription(tool),
        });
      }
      const bloated = tools.filter((t) => t.description.trim().length > 400).slice(0, 3);
      for (const tool of bloated) {
        const trimmed = trimDescription(tool);
        fixes.push({
          checkId: check.id,
          problem: `Bloated description on \`${tool.name}\``,
          current: tool.description.slice(0, 180) + "...",
          suggested: trimmed,
        });
      }
    }

    if (check.id === "property-descriptions") {
      fixes.push({
        checkId: check.id,
        problem: check.detail ?? check.message,
        suggested: "Add a description on every inputSchema.properties field so agents know what to pass.",
      });
    }

    if (check.id === "unconstrained-strings") {
      fixes.push({
        checkId: check.id,
        problem: check.detail ?? check.message,
        suggested: "Constrain string fields with enum, format, or pattern instead of a bare type: string.",
      });
    }

    if (check.id === "missing-required") {
      fixes.push({
        checkId: check.id,
        problem: check.detail ?? check.message,
        suggested: "Declare inputSchema.required for properties the tool cannot run without.",
      });
    }

    if (check.id === "discovery" || check.id === "missing-input-schema") {
      fixes.push({
        checkId: check.id,
        problem: check.detail ?? check.message,
        suggested:
          'Add inputSchema: { type: "object", properties: {} } on the malformed tool (empty object is valid when it takes no arguments).',
      });
    }

    if (check.id === "output-schema") {
      fixes.push({
        checkId: check.id,
        problem: check.detail ?? check.message,
        suggested:
          'Declare outputSchema so agents know the return shape, for example:\n{\n  "type": "object",\n  "properties": { "ok": { "type": "boolean" } },\n  "required": ["ok"]\n}',
      });
    }

    if (check.id === "destructive-warnings") {
      fixes.push({
        checkId: check.id,
        problem: "Destructive tool without warning",
        suggested:
          "Prefix the description with 'DESTRUCTIVE: irreversible. Requires explicit confirmation.' and add a required confirm boolean parameter.",
      });
    }

    if (check.id === "tool-count") {
      fixes.push({
        checkId: check.id,
        problem: check.message,
        suggested: "Group tools by domain with progressive discovery. Target <15 tools in initial context.",
      });
    }

    if (check.id === "token-footprint") {
      fixes.push({
        checkId: check.id,
        problem: check.message,
        suggested: "Trim schemas, cap descriptions to 80 chars, use discovery meta-tools per tag.",
      });
    }

    if (check.id === "credential-in-args") {
      fixes.push({
        checkId: check.id,
        problem: check.detail ?? check.message,
        suggested:
          "Do not put secrets in tool arguments. Read API keys from environment variables or server headers instead.",
      });
    }

    if (check.id === "security-smells" && check.detail) {
      const liveExec = /command execution surface/.test(check.detail);
      fixes.push({
        checkId: check.id,
        problem: check.detail,
        suggested: liveExec
          ? "Avoid exposing shell/exec/eval surfaces in tool names, descriptions, or schemas."
          : "Do not put credentials in query parameters; keep secrets on the server.",
      });
    }

    if (check.id === "pagination") {
      fixes.push({
        checkId: check.id,
        problem: check.detail ?? check.message,
        suggested: "Add limit/cursor/offset (or page) parameters to list/search tools.",
      });
    }
  }

  return fixes.slice(0, 12);
}

function withTokenDelta(current: string, suggested: string): string {
  const delta = estimateTokens(suggested) - estimateTokens(current);
  if (delta >= 0) {
    return `${suggested} This adds ~${delta} tokens vs current.`;
  }
  return `${suggested} This saves ~${Math.abs(delta)} tokens vs current.`;
}

function expandDescription(tool: ApiTool): string {
  const current = tool.description.trim();
  if (!current) {
    return `Write a one-sentence purpose for ${tool.name}: what it returns and which required params the agent must pass.`;
  }
  const sentence = /[.!?]$/.test(current) ? current : `${current}.`;
  const suggested = `${sentence} Say when to choose this tool versus siblings, not just that it performs this operation.`;
  return withTokenDelta(current, suggested);
}

function trimDescription(tool: ApiTool): string {
  const suggested = `Rewrite \`${tool.name}\` as one complete sentence under 80 characters: state what it returns and when to choose it.`;
  return withTokenDelta(tool.description, suggested);
}

export function formatSuggestedFixes(fixes: SuggestedFix[]): string {
  if (fixes.length === 0) {
    return "## Recommended Improvements\n\nNo high-priority fixes suggested.";
  }
  const lines = ["## Recommended Improvements", ""];
  for (const fix of fixes) {
    lines.push(`### ${fix.problem}`, "");
    if (fix.current) {
      lines.push("**Current:**", "```", fix.current, "```", "");
    }
    lines.push("**Suggested:**", "```", fix.suggested, "```", "");
  }
  return lines.join("\n");
}
