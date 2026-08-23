import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { operationsFromDoc, type ApiTool } from "./openapi.js";
import { formatScorecardReport, runScorecard } from "./scorecard.js";
import { mcpToolToApiTool } from "./inspect.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../fixtures/bloated-platform-api.json"), "utf8"),
);

function liveTool(partial: {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  missingInputSchema?: boolean;
}): ApiTool {
  return mcpToolToApiTool(
    {
      name: partial.name,
      description: partial.description,
      inputSchema: (partial.inputSchema ?? { type: "object", properties: {} }) as Tool["inputSchema"],
      ...(partial.outputSchema ? { outputSchema: partial.outputSchema } : {}),
    } as Tool,
    { missingInputSchema: partial.missingInputSchema },
  );
}

describe("runScorecard", () => {
  it("flags bloated demo API with warnings or failures", () => {
    const tools = operationsFromDoc(fixture);
    const result = runScorecard(fixture, tools, { mode: "openapi" });
    assert.ok(result.toolCount >= 20);
    assert.ok(result.checks.some((c) => c.severity === "warn" || c.severity === "fail"));
    assert.ok(result.checks.some((c) => c.id === "tool-count"));
    assert.ok(result.checks.some((c) => c.id === "token-footprint"));
  });

  it("returns grade letter", () => {
    const tools = operationsFromDoc(fixture);
    const result = runScorecard(fixture, tools);
    assert.match(result.grade, /^[A-F]$/);
  });
});

describe("PulseOps-shaped live scorecard", () => {
  const executive = liveTool({
    name: "generate_postmortem_ai_report",
    description:
      "Generate a structured Root Cause Analysis. 1. Executive Summary: high-level overview of the incident.",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string", description: "Incident identifier", format: "uuid" },
      },
      required: ["incident_id"],
    },
    outputSchema: { type: "object", properties: { markdown: { type: "string" } } },
  });

  it("does not flag Executive/Execute as command execution", () => {
    const executeQuery = liveTool({
      name: "query_metrics",
      description: "Execute a Prometheus PromQL metric query against the timeseries backend.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "PromQL expression", pattern: ".+" },
        },
        required: ["query"],
      },
      outputSchema: { type: "object", properties: { series: { type: "array" } } },
    });
    const result = runScorecard(
      { info: { title: "pulseops" } },
      [executive, executeQuery],
      { mode: "live" },
    );
    const smell = result.checks.find((c) => c.id === "security-smells");
    assert.equal(smell?.severity, "pass");
    const report = formatScorecardReport(result);
    assert.equal(report.includes("OpenAPI"), false);
    assert.equal(report.includes("v0.2"), false);
    assert.equal(/analyze <|\banalyze\b.*token/.test(report), false);
    assert.match(report, /live MCP/);
  });

  it("flags nuke_* as destructive", () => {
    const result = runScorecard(
      { info: { title: "pulseops" } },
      [
        liveTool({
          name: "nuke_environment_cache",
          description: "Flushes all Redis and Memcached cluster tiers immediately.",
        }),
      ],
      { mode: "live" },
    );
    const check = result.checks.find((c) => c.id === "destructive-warnings");
    assert.equal(check?.severity, "warn");
    assert.match(check?.detail ?? "", /nuke_environment_cache/);
  });

  it("fails credential-like arguments such as pd_token", () => {
    const result = runScorecard(
      { info: { title: "pulseops" } },
      [
        liveTool({
          name: "trigger_pagerduty_escalation",
          description: "Trigger high-urgency PagerDuty escalation for the primary on-call rotation.",
          inputSchema: {
            type: "object",
            properties: {
              pd_token: { type: "string", description: "PagerDuty REST API Bearer Token" },
            },
            required: ["pd_token"],
          },
        }),
      ],
      { mode: "live" },
    );
    const check = result.checks.find((c) => c.id === "credential-in-args");
    assert.equal(check?.severity, "fail");
    assert.match(check?.detail ?? "", /pd_token/);
  });

  it("fails a 4-word tool description instead of hiding it in an average", () => {
    const result = runScorecard(
      { info: { title: "pulseops" } },
      [
        liveTool({
          name: "query_metrics",
          description: "Queries metrics from backend",
        }),
        liveTool({
          name: "list_incidents",
          description: "Retrieve a filtered list of production incidents with severity and status.",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "integer", description: "Page size" },
            },
            required: ["limit"],
          },
        }),
      ],
      { mode: "live" },
    );
    const check = result.checks.find((c) => c.id === "descriptions");
    assert.equal(check?.severity, "warn");
    assert.match(check?.detail ?? "", /query_metrics/);
  });

  it("fails empty descriptions even when other tools are well documented", () => {
    const result = runScorecard(
      { info: { title: "pulseops" } },
      [
        liveTool({ name: "query_metrics", description: "" }),
        liveTool({
          name: "list_incidents",
          description: "Retrieve a filtered list of production incidents with severity and status.",
        }),
      ],
      { mode: "live" },
    );
    const check = result.checks.find((c) => c.id === "descriptions");
    assert.equal(check?.severity, "fail");
    assert.match(check?.detail ?? "", /query_metrics/);
  });

  it("treats list_* tools as pagination candidates regardless of HTTP method", () => {
    const result = runScorecard(
      { info: { title: "pulseops" } },
      [
        liveTool({
          name: "list_incidents",
          description: "Retrieve production incidents from PulseOps for on-call triage.",
          inputSchema: {
            type: "object",
            properties: {
              status: { type: "string", description: "Lifecycle filter", enum: ["open", "closed"] },
            },
            required: ["status"],
          },
        }),
      ],
      { mode: "live" },
    );
    const check = result.checks.find((c) => c.id === "pagination");
    assert.notEqual(check?.severity, "info");
    assert.match(check?.message ?? "", /pagination/i);
  });

  it("does not talk about OpenAPI security schemes on live inspect", () => {
    const result = runScorecard(
      { info: { title: "pulseops" } },
      [
        liveTool({
          name: "get_incident_details",
          description: "Fetch complete incident metadata and investigation timeline for responders.",
          inputSchema: {
            type: "object",
            properties: {
              incident_id: { type: "string", description: "Incident id", format: "uuid" },
            },
            required: ["incident_id"],
          },
          outputSchema: { type: "object", properties: { id: { type: "string" } } },
        }),
      ],
      { mode: "live" },
    );
    assert.equal(result.checks.some((c) => c.id === "auth-clarity"), false);
    assert.equal(formatScorecardReport(result).includes("security schemes"), false);
  });
});

describe("CloudShelf 0.4.3 scorecard", () => {
  it("scores discovery failure as 0 / F, not Grade A", () => {
    const result = runScorecard(
      { info: { title: "cloudshelf-mcp" } },
      [],
      {
        mode: "live",
        discoveryFailed: true,
        discoveryError:
          'listTools: Invalid input: expected object, received undefined at tools.6.inputSchema',
      },
    );
    assert.equal(result.score, 0);
    assert.equal(result.grade, "F");
    assert.equal(result.toolCount, 0);
    const discovery = result.checks.find((c) => c.id === "discovery");
    assert.equal(discovery?.severity, "fail");
    assert.match(discovery?.detail ?? "", /inputSchema/);
    assert.match(discovery?.detail ?? "", /Tool #6/);
    assert.equal(/Invalid input: expected object/.test(discovery?.detail ?? ""), false);
    assert.equal(result.checks.some((c) => c.severity === "pass"), false);
  });

  it("fails 0 tools without discovery errors instead of awarding a pass", () => {
    const result = runScorecard({ info: { title: "empty" } }, [], { mode: "live" });
    assert.equal(result.score, 0);
    assert.equal(result.grade, "F");
    const count = result.checks.find((c) => c.id === "tool-count");
    assert.equal(count?.severity, "fail");
    assert.match(count?.message ?? "", /0 tools advertised/);
  });

  it("flags CloudShelf purging/zeroing description as destructive until CAUTION prefix", () => {
    const unmarked = liveTool({
      name: "recalibrate_warehouse_bins",
      description:
        "Recalibrates all bin coordinate partitions, purging orphaned allocations and zeroing all untracked physical bin items immediately.",
    });
    const unmarkedResult = runScorecard({ info: { title: "cloudshelf" } }, [unmarked], { mode: "live" });
    const unmarkedCheck = unmarkedResult.checks.find((c) => c.id === "destructive-warnings");
    assert.equal(unmarkedCheck?.severity, "warn");
    assert.match(unmarkedCheck?.detail ?? "", /recalibrate_warehouse_bins/);

    const marked = liveTool({
      name: "recalibrate_warehouse_bins",
      description:
        "CAUTION / DESTRUCTIVE: Recalibrate coordinate partitions in a warehouse zone, purging orphaned allocations and resetting untracked physical bins.",
    });
    const markedResult = runScorecard({ info: { title: "cloudshelf" } }, [marked], { mode: "live" });
    const markedCheck = markedResult.checks.find((c) => c.id === "destructive-warnings");
    assert.equal(markedCheck?.severity, "pass");
  });

  it("treats live missing outputSchema as info, not a score warning", () => {
    const result = runScorecard(
      { info: { title: "cloudshelf" } },
      [
        liveTool({
          name: "get_sku_inventory",
          description: "Retrieve real-time stock levels, allocated units, and bin location breakdown for a given SKU.",
          inputSchema: {
            type: "object",
            properties: {
              sku: { type: "string", description: "SKU", pattern: "^SKU-" },
            },
            required: ["sku"],
          },
        }),
      ],
      { mode: "live" },
    );
    const check = result.checks.find((c) => c.id === "output-schema");
    assert.equal(check?.severity, "info");
  });

  it("does not warn unconstrained identifier or query strings; warns enum-like names", () => {
    const result = runScorecard(
      { info: { title: "cloudshelf" } },
      [
        liveTool({
          name: "query_raw_audit_log",
          description: "Query warehouse compliance logs and fulfillment telemetry records by tenant and filters.",
          inputSchema: {
            type: "object",
            properties: {
              tenant_id: { type: "string", description: "Tenant UUID" },
              sku: { type: "string", description: "SKU" },
              zone: { type: "string", description: "Warehouse zone" },
              category: { type: "string", description: "Product category" },
            },
            required: ["tenant_id"],
          },
        }),
      ],
      { mode: "live" },
    );
    const unconstrained = result.checks.filter((c) => c.id === "unconstrained-strings");
    const warn = unconstrained.find((c) => c.severity === "warn");
    const info = unconstrained.find((c) => c.severity === "info");
    assert.equal(warn?.severity, "warn");
    assert.match(warn?.detail ?? "", /category/);
    assert.equal((warn?.detail ?? "").includes("sku"), false);
    assert.equal((warn?.detail ?? "").includes("tenant_id"), false);
    assert.ok(info);
    assert.match(info?.detail ?? "", /zone/);
  });

  it("shows +N more when more than 8 tools lack output schema", () => {
    const tools = Array.from({ length: 10 }, (_, i) =>
      liveTool({
        name: `tool_${i}`,
        description: "A reasonably long tool description for agent readiness checks here.",
      }),
    );
    const result = runScorecard({ info: { title: "cloudshelf" } }, tools, { mode: "live" });
    const check = result.checks.find((c) => c.id === "output-schema");
    assert.match(check?.detail ?? "", /\(\+2 more\)/);
  });
});

describe("BeaconHub 0.4.4 scorecard", () => {
  it("treats required: [] on a list tool as missing-required pass", () => {
    const result = runScorecard(
      { info: { title: "beaconhub" } },
      [
        liveTool({
          name: "list_deployments",
          description: "List deployments with optional environment and status filters for operators.",
          inputSchema: {
            type: "object",
            properties: {
              environment: { type: "string", description: "Environment name", enum: ["prod", "stage"] },
              status: { type: "string", description: "Rollout status", enum: ["live", "failed"] },
            },
            required: [],
          },
        }),
      ],
      { mode: "live" },
    );
    const check = result.checks.find((c) => c.id === "missing-required");
    assert.equal(check?.severity, "pass");
  });

  it("treats an absent required key as all-optional Zod semantics", () => {
    const result = runScorecard(
      { info: { title: "beaconhub" } },
      [
        liveTool({
          name: "list_deployments",
          description: "List deployments with optional environment and status filters for operators.",
          inputSchema: {
            type: "object",
            properties: {
              environment: { type: "string", description: "Environment name", enum: ["prod", "stage"] },
            },
          },
        }),
      ],
      { mode: "live" },
    );
    const check = result.checks.find((c) => c.id === "missing-required");
    assert.equal(check?.severity, "pass");
  });

  it("warns when required is present but is not an array", () => {
    const result = runScorecard(
      { info: { title: "beaconhub" } },
      [
        liveTool({
          name: "list_deployments",
          description: "List deployments with optional environment filters for operators.",
          inputSchema: {
            type: "object",
            properties: {
              environment: { type: "string", description: "Environment name" },
            },
            required: "environment",
          },
        }),
      ],
      { mode: "live" },
    );
    const check = result.checks.find((c) => c.id === "missing-required");
    assert.equal(check?.severity, "warn");
    assert.match(check?.detail ?? "", /list_deployments/);
  });

  it("fails secret_api_key but not vault_pointer or credential_secret_ref", () => {
    const result = runScorecard(
      { info: { title: "beaconhub" } },
      [
        liveTool({
          name: "rotate_signing_material",
          description: "Rotate signing material for a deployment using vault references, not raw secrets.",
          inputSchema: {
            type: "object",
            properties: {
              secret_api_key: { type: "string", description: "The API key itself" },
              vault_pointer: { type: "string", description: "Path to the secret in vault" },
              credential_secret_ref: { type: "string", description: "Env var name holding the credential" },
            },
            required: ["secret_api_key"],
          },
        }),
      ],
      { mode: "live" },
    );
    const check = result.checks.find((c) => c.id === "credential-in-args");
    assert.equal(check?.severity, "fail");
    assert.match(check?.detail ?? "", /secret_api_key/);
    assert.equal((check?.detail ?? "").includes("vault_pointer"), false);
    assert.equal((check?.detail ?? "").includes("credential_secret_ref"), false);
  });

  it("flags a secret reference when the description says it is a bearer token", () => {
    const result = runScorecard(
      { info: { title: "beaconhub" } },
      [
        liveTool({
          name: "call_upstream",
          description: "Call an upstream API using a referenced credential for authentication.",
          inputSchema: {
            type: "object",
            properties: {
              vault_pointer: { type: "string", description: "Bearer token for the upstream API" },
            },
            required: ["vault_pointer"],
          },
        }),
      ],
      { mode: "live" },
    );
    const check = result.checks.find((c) => c.id === "credential-in-args");
    assert.equal(check?.severity, "fail");
    assert.match(check?.detail ?? "", /vault_pointer/);
  });

  it("does not flag update_routing_policy just because the description says remove", () => {
    const result = runScorecard(
      { info: { title: "beaconhub" } },
      [
        liveTool({
          name: "update_routing_policy",
          description:
            "Update traffic routing policy for a service, including weights used to remove failed backends from rotation.",
        }),
      ],
      { mode: "live" },
    );
    const check = result.checks.find((c) => c.id === "destructive-warnings");
    assert.notEqual(check?.severity, "warn");
  });

  it("flags prune_stale_caches purging/zeroing until a CAUTION prefix", () => {
    const unmarked = liveTool({
      name: "prune_stale_caches",
      description: "Purging and zeroing stale edge caches for the selected service immediately.",
    });
    const unmarkedResult = runScorecard({ info: { title: "beaconhub" } }, [unmarked], { mode: "live" });
    const unmarkedCheck = unmarkedResult.checks.find((c) => c.id === "destructive-warnings");
    assert.equal(unmarkedCheck?.severity, "warn");
    assert.match(unmarkedCheck?.detail ?? "", /prune_stale_caches/);

    const marked = liveTool({
      name: "prune_stale_caches",
      description:
        "CAUTION / DESTRUCTIVE: Purging and zeroing stale edge caches for the selected service immediately.",
    });
    const markedResult = runScorecard({ info: { title: "beaconhub" } }, [marked], { mode: "live" });
    const markedCheck = markedResult.checks.find((c) => c.id === "destructive-warnings");
    assert.equal(markedCheck?.severity, "pass");
  });

  it("fails a recovered tool that omitted inputSchema", () => {
    const result = runScorecard(
      { info: { title: "beaconhub" } },
      [
        liveTool({
          name: "reboot_canary",
          description: "Reboots the canary instance after a failed health check window.",
          missingInputSchema: true,
        }),
      ],
      { mode: "live" },
    );
    const check = result.checks.find((c) => c.id === "missing-input-schema");
    assert.equal(check?.severity, "fail");
    assert.match(check?.detail ?? "", /reboot_canary/);
    assert.equal(result.grade, "F");
    assert.ok(result.score <= 39);
  });
});

describe("RelayDesk 0.4.5 scorecard", () => {
  it("does not award Grade A to the cosmetic VendorMesh patch", () => {
    const result = runScorecard(
      { info: { title: "vendormesh" } },
      [
        liveTool({
          name: "sync_stuff",
          description: "Synchronize vendor records with the configured upstream system.",
          inputSchema: {
            type: "object",
            properties: {
              api_key_env_ref: { type: "string", description: "Environment variable name containing the API key" },
            },
            required: ["api_key_env_ref"],
          },
        }),
      ],
      { mode: "live" },
    );
    assert.equal(result.grade, "B");
    assert.equal(result.score, 84);
    assert.equal(result.checks.find((c) => c.id === "ambiguous-names")?.severity, "warn");
    assert.equal(result.checks.find((c) => c.id === "output-schema")?.severity, "info");
  });

  it("caps an unmarked destructive tool below Grade A", () => {
    const result = runScorecard(
      { info: { title: "vendormesh" } },
      [
        liveTool({
          name: "purge_stale_quotes",
          description: "Purging stale quotes from the vendor cache immediately.",
          outputSchema: { type: "object", properties: { removed: { type: "integer" } } },
        }),
      ],
      { mode: "live" },
    );
    assert.equal(result.grade, "B");
    assert.ok(result.score <= 84);
  });

  it("flags api_secret as a credential value field", () => {
    const result = runScorecard(
      { info: { title: "relaydesk" } },
      [
        liveTool({
          name: "store_credential",
          description: "Store an operator credential for later dispatch alerts.",
          inputSchema: {
            type: "object",
            properties: {
              api_secret: { type: "string", description: "Shared API secret" },
            },
            required: ["api_secret"],
          },
        }),
      ],
      { mode: "live" },
    );
    const check = result.checks.find((c) => c.id === "credential-in-args");
    assert.equal(check?.severity, "fail");
    assert.match(check?.detail ?? "", /api_secret/);
  });

  it("flags a *_ref when the description still says it is an auth token to pass", () => {
    const result = runScorecard(
      { info: { title: "northwind" } },
      [
        liveTool({
          name: "send_dispatch_alert",
          description: "Send a dispatch SMS via Twilio.",
          inputSchema: {
            type: "object",
            properties: {
              twilio_token_ref: { type: "string", description: "Twilio auth token to pass" },
            },
            required: ["twilio_token_ref"],
          },
        }),
      ],
      { mode: "live" },
    );
    const check = result.checks.find((c) => c.id === "credential-in-args");
    assert.equal(check?.severity, "fail");
    assert.match(check?.detail ?? "", /twilio_token_ref/);
  });

  it("caps missing-input-schema score at 39 / F when other tools are listed", () => {
    const result = runScorecard(
      { info: { title: "relaydesk" } },
      [
        liveTool({
          name: "list_incidents",
          description: "List P1 incidents with optional severity and hub filters for operators.",
          inputSchema: {
            type: "object",
            properties: {
              hub: { type: "string", description: "Hub code", enum: ["EAST", "WEST"] },
            },
            required: [],
          },
        }),
        liveTool({
          name: "sync_catalog",
          description: "Sync the catalog after a failed inbound payload window.",
          missingInputSchema: true,
        }),
      ],
      { mode: "live" },
    );
    assert.equal(result.grade, "F");
    assert.ok(result.score > 0);
    assert.ok(result.score <= 39);
    assert.equal(result.toolCount, 2);
  });

  it("warns on description walls over 400 characters", () => {
    const wall = "Broadcast status to every on-call rotator. ".repeat(20);
    const result = runScorecard(
      { info: { title: "relaydesk" } },
      [
        liveTool({
          name: "broadcast_status",
          description: wall,
        }),
      ],
      { mode: "live" },
    );
    const check = result.checks.find((c) => c.id === "descriptions");
    assert.equal(check?.severity, "warn");
    assert.match(check?.detail ?? "", /broadcast_status/);
  });

  it("warns on purge_* names and does not treat permanently as a full mark", () => {
    const purge = liveTool({
      name: "purge_stale_sessions",
      description: "Purging operation: permanently removes stale operator sessions from the hot store.",
    });
    const result = runScorecard({ info: { title: "relaydesk" } }, [purge], { mode: "live" });
    const check = result.checks.find((c) => c.id === "destructive-warnings");
    assert.equal(check?.severity, "warn");
    assert.match(check?.detail ?? "", /purge_stale_sessions/);
  });

  it("warns on zero_* names until DESTRUCTIVE or a required confirm boolean", () => {
    const unmarked = liveTool({
      name: "zero_audit_trail",
      description: "Zero inactive audit rows for the selected tenant immediately.",
    });
    const unmarkedResult = runScorecard({ info: { title: "relaydesk" } }, [unmarked], { mode: "live" });
    assert.equal(unmarkedResult.checks.find((c) => c.id === "destructive-warnings")?.severity, "warn");

    const confirmed = liveTool({
      name: "zero_audit_trail",
      description: "Zero inactive audit rows for the selected tenant immediately.",
      inputSchema: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Must be true to proceed" },
        },
        required: ["confirm"],
      },
    });
    const confirmedResult = runScorecard({ info: { title: "relaydesk" } }, [confirmed], { mode: "live" });
    assert.equal(confirmedResult.checks.find((c) => c.id === "destructive-warnings")?.severity, "pass");
  });

  it("does not treat prefixing one sibling as marking the rest", () => {
    const result = runScorecard(
      { info: { title: "relaydesk" } },
      [
        liveTool({
          name: "prune_orphaned_webhooks",
          description: "DESTRUCTIVE: prune orphaned webhook rows. Requires confirmation.",
        }),
        liveTool({
          name: "purge_stale_sessions",
          description: "Purging stale operator sessions from the hot store.",
        }),
      ],
      { mode: "live" },
    );
    const check = result.checks.find((c) => c.id === "destructive-warnings");
    assert.equal(check?.severity, "warn");
    assert.match(check?.detail ?? "", /purge_stale_sessions/);
    assert.equal((check?.detail ?? "").includes("prune_orphaned_webhooks"), false);
  });
});
