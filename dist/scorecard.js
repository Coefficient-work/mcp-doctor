import { operationsFromDoc } from "./openapi.js";
import { perToolTokens, toolsTokenCount } from "./tokens.js";
const DESTRUCTIVE_METHODS = new Set(["DELETE", "PUT", "PATCH"]);
const DESTRUCTIVE_NAME_RE = /delete|remove|destroy|purge|drop|cancel/i;
export function runScorecard(doc, tools = operationsFromDoc(doc)) {
    const title = doc.info?.title ?? "API";
    const checks = [];
    checks.push(...checkToolCount(tools));
    checks.push(...checkTokenFootprint(tools));
    checks.push(...checkDuplicateNames(tools));
    checks.push(...checkDescriptions(tools));
    checks.push(...checkDestructiveTools(tools));
    checks.push(...checkSchemaComplexity(tools));
    checks.push(...checkPagination(tools, doc));
    checks.push(...checkAuthClarity(doc));
    checks.push(...checkSecuritySmells(tools));
    const score = computeScore(checks);
    return {
        title,
        score,
        grade: gradeFromScore(score),
        checks,
        toolCount: tools.length,
        tokenCount: toolsTokenCount(tools),
    };
}
function computeScore(checks) {
    let score = 100;
    for (const check of checks) {
        if (check.severity === "fail")
            score -= 12;
        else if (check.severity === "warn")
            score -= 5;
    }
    return Math.max(0, Math.min(100, score));
}
function gradeFromScore(score) {
    if (score >= 85)
        return "A";
    if (score >= 70)
        return "B";
    if (score >= 55)
        return "C";
    if (score >= 40)
        return "D";
    return "F";
}
function checkToolCount(tools) {
    const n = tools.length;
    if (n > 40) {
        return [{
                id: "tool-count",
                category: "tools",
                severity: "fail",
                message: `${n} tools � likely hurts agent tool selection`,
                detail: "Consider progressive discovery or grouping (see `mcp-doctor analyze --demo`)",
            }];
    }
    if (n > 15) {
        return [{
                id: "tool-count",
                category: "tools",
                severity: "warn",
                message: `${n} tools � high context cost for agents`,
            }];
    }
    return [{
            id: "tool-count",
            category: "tools",
            severity: "pass",
            message: `${n} tools � reasonable surface area`,
        }];
}
function checkTokenFootprint(tools) {
    const tokens = toolsTokenCount(tools);
    if (tokens > 20_000) {
        return [{
                id: "token-footprint",
                category: "tokens",
                severity: "fail",
                message: `~${tokens.toLocaleString()} tokens in tool definitions`,
                detail: "Agents may exhaust context before user tasks",
            }];
    }
    if (tokens > 8_000) {
        return [{
                id: "token-footprint",
                category: "tokens",
                severity: "warn",
                message: `~${tokens.toLocaleString()} tokens in tool definitions`,
            }];
    }
    return [{
            id: "token-footprint",
            category: "tokens",
            severity: "pass",
            message: `~${tokens.toLocaleString()} tokens in tool definitions`,
        }];
}
function checkDuplicateNames(tools) {
    const names = tools.map((t) => t.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    const ambiguous = tools.filter((t) => t.name.length < 4 || /^[a-z]$/.test(t.name));
    const results = [];
    if (dupes.length > 0) {
        results.push({
            id: "duplicate-names",
            category: "tools",
            severity: "fail",
            message: `Duplicate tool names: ${[...new Set(dupes)].join(", ")}`,
        });
    }
    else {
        results.push({
            id: "duplicate-names",
            category: "tools",
            severity: "pass",
            message: "No duplicate tool names",
        });
    }
    if (ambiguous.length > 0) {
        results.push({
            id: "ambiguous-names",
            category: "tools",
            severity: "warn",
            message: `${ambiguous.length} tool(s) with very short or unclear names`,
            detail: ambiguous.slice(0, 5).map((t) => t.name).join(", "),
        });
    }
    return results;
}
function checkDescriptions(tools) {
    const missing = tools.filter((t) => !t.description || t.description.length < 12);
    const thin = tools.filter((t) => t.description.length > 0 && t.description.length < 30);
    if (missing.length > tools.length * 0.2) {
        return [{
                id: "descriptions",
                category: "docs",
                severity: "fail",
                message: `${missing.length}/${tools.length} tools lack useful descriptions`,
            }];
    }
    if (thin.length > tools.length * 0.3) {
        return [{
                id: "descriptions",
                category: "docs",
                severity: "warn",
                message: `${thin.length} tools have thin descriptions (<30 chars)`,
            }];
    }
    return [{
            id: "descriptions",
            category: "docs",
            severity: "pass",
            message: "Tool descriptions look adequate for agents",
        }];
}
function checkDestructiveTools(tools) {
    const destructive = tools.filter((t) => DESTRUCTIVE_METHODS.has(t.method) ||
        DESTRUCTIVE_NAME_RE.test(t.name) ||
        DESTRUCTIVE_NAME_RE.test(t.description));
    const unmarked = destructive.filter((t) => !/destructive|danger|irreversible|cannot be undone|permanent/i.test(t.description));
    if (unmarked.length > 0) {
        return [{
                id: "destructive-warnings",
                category: "safety",
                severity: "warn",
                message: `${unmarked.length} destructive tool(s) without explicit warnings in description`,
                detail: unmarked.slice(0, 5).map((t) => t.name).join(", "),
            }];
    }
    if (destructive.length > 0) {
        return [{
                id: "destructive-warnings",
                category: "safety",
                severity: "pass",
                message: `${destructive.length} destructive tool(s) marked appropriately`,
            }];
    }
    return [{
            id: "destructive-warnings",
            category: "safety",
            severity: "info",
            message: "No obviously destructive operations detected",
        }];
}
function checkSchemaComplexity(tools) {
    const complex = tools.filter((t) => {
        const props = t.inputSchema.properties ?? {};
        const depth = schemaDepth(t.inputSchema);
        return Object.keys(props).length > 12 || depth > 4;
    });
    if (complex.length > tools.length * 0.25) {
        return [{
                id: "schema-complexity",
                category: "schema",
                severity: "warn",
                message: `${complex.length} tools have complex input schemas`,
                detail: "Deep or wide schemas increase parameter mistakes",
            }];
    }
    return [{
            id: "schema-complexity",
            category: "schema",
            severity: "pass",
            message: "Input schemas are reasonably sized",
        }];
}
function schemaDepth(obj, depth = 0) {
    if (obj === null || typeof obj !== "object" || depth > 10)
        return depth;
    let max = depth;
    for (const value of Object.values(obj)) {
        max = Math.max(max, schemaDepth(value, depth + 1));
    }
    return max;
}
function checkPagination(tools, doc) {
    const listOps = tools.filter((t) => t.method === "GET" && /list|search|index|all/i.test(t.name + t.path));
    if (listOps.length === 0) {
        return [{
                id: "pagination",
                category: "schema",
                severity: "info",
                message: "No list/search endpoints detected � pagination check skipped",
            }];
    }
    const hasPageParams = listOps.some((t) => {
        const props = t.inputSchema.properties ?? {};
        const keys = Object.keys(props).join(" ").toLowerCase();
        return /page|cursor|offset|limit|after|before/.test(keys);
    });
    if (!hasPageParams && listOps.length > 0) {
        return [{
                id: "pagination",
                category: "schema",
                severity: "warn",
                message: `${listOps.length} list endpoint(s) may lack pagination parameters`,
                detail: listOps.slice(0, 3).map((t) => t.name).join(", "),
            }];
    }
    return [{
            id: "pagination",
            category: "schema",
            severity: "pass",
            message: "List endpoints appear to support pagination",
        }];
}
function checkAuthClarity(doc) {
    const security = doc.security;
    const schemes = doc.components;
    const securitySchemes = schemes?.securitySchemes;
    if (!securitySchemes || Object.keys(securitySchemes).length === 0) {
        return [{
                id: "auth-clarity",
                category: "auth",
                severity: "info",
                message: "No security schemes defined in OpenAPI",
            }];
    }
    const unnamed = Object.entries(securitySchemes).filter(([, s]) => {
        const scheme = s;
        return !scheme.description && !scheme.type;
    });
    if (unnamed.length > 0) {
        return [{
                id: "auth-clarity",
                category: "auth",
                severity: "warn",
                message: `${unnamed.length} auth scheme(s) lack description � agents struggle with auth recovery`,
            }];
    }
    if (!security || security.length === 0) {
        return [{
                id: "auth-clarity",
                category: "auth",
                severity: "warn",
                message: "Security schemes defined but no global security requirements",
            }];
    }
    return [{
            id: "auth-clarity",
            category: "auth",
            severity: "pass",
            message: `Auth schemes documented (${Object.keys(securitySchemes).join(", ")})`,
        }];
}
function checkSecuritySmells(tools) {
    const smells = [];
    for (const tool of tools) {
        const blob = JSON.stringify(tool).toLowerCase();
        if (/password|secret|api[_-]?key|token|credential/.test(blob) && tool.method === "GET") {
            smells.push(`${tool.name}: sensitive field on GET`);
        }
        if (/exec|shell|eval|system\(|rm -rf/.test(blob)) {
            smells.push(`${tool.name}: possible command execution surface`);
        }
    }
    if (smells.length > 0) {
        return [{
                id: "security-smells",
                category: "safety",
                severity: "fail",
                message: `${smells.length} potential security smell(s)`,
                detail: smells.slice(0, 5).join("; "),
            }];
    }
    return [{
            id: "security-smells",
            category: "safety",
            severity: "pass",
            message: "No obvious security smells in tool definitions",
        }];
}
export function formatScorecardReport(result) {
    const icon = { pass: "?", warn: "!", fail: "?", info: "�" };
    const lines = [
        `# MCP Agent Readiness: ${result.title}`,
        "",
        `**Score: ${result.score}/100 (Grade ${result.grade})**`,
        "",
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Tools | ${result.toolCount} |`,
        `| Est. tokens | ${result.tokenCount.toLocaleString()} |`,
        `| Checks | ${result.checks.length} |`,
        "",
        "## Checks",
        "",
    ];
    for (const check of result.checks) {
        lines.push(`- [${icon[check.severity]}] **${check.id}** � ${check.message}`);
        if (check.detail)
            lines.push(`  - ${check.detail}`);
    }
    lines.push("", "---", "_Static scorecard from OpenAPI ? MCP tool projection. Live protocol, drift, and agent evals coming in v0.2._", "", "**Next:** `mcp-doctor analyze` for token optimization � `mcp-doctor competitors` for market map");
    return lines.join("\n");
}
export function topTokenConsumers(tools, limit = 5) {
    return perToolTokens(tools).sort((a, b) => b.tokens - a.tokens).slice(0, limit);
}
