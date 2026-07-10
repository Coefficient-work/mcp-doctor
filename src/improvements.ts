import type { ScorecardCheck } from "./scorecard.js";
import type { ApiTool } from "./openapi.js";

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
    }

    if (check.id === "destructive-warnings") {
      fixes.push({
        checkId: check.id,
        problem: "Destructive tool without warning",
        suggested:
          "Add to description: 'DESTRUCTIVE: irreversible. Requires explicit confirmation.'",
      });
    }

    if (check.id === "tool-count") {
      fixes.push({
        checkId: check.id,
        problem: check.message,
        suggested:
          "Group tools by domain with progressive discovery (see `mcp-doctor analyze`). Target <15 tools in initial context.",
      });
    }

    if (check.id === "token-footprint") {
      fixes.push({
        checkId: check.id,
        problem: check.message,
        suggested: "Trim schemas, cap descriptions to 80 chars, use discovery meta-tools per tag.",
      });
    }

    if (check.id === "security-smells" && check.detail) {
      fixes.push({
        checkId: check.id,
        problem: check.detail,
        suggested: "Move sensitive fields to POST body; never expose credentials on GET tools.",
      });
    }
  }

  return fixes.slice(0, 12);
}

function expandDescription(tool: ApiTool): string {
  const verb = tool.name.replace(/_/g, " ");
  return `${capitalize(verb)}. Use when the agent needs to perform this operation. Required params are in inputSchema.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
