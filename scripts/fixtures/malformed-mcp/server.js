#!/usr/bin/env node
/**
 * Deterministic stdio MCP used by scripts/prepublish-gate.sh.
 * Speaks the MCP SDK's newline-delimited JSON-RPC (not Content-Length).
 * This file is ESM because the repo package.json has "type": "module".
 *
 *   node server.js              # inspect_payload omits inputSchema
 *   node server.js --with-schema
 */
import { stdin, stdout } from "node:process";

const withSchema = process.argv.includes("--with-schema");

function inspectPayloadTool() {
  const tool = {
    name: "inspect_payload",
    description: "Inspect an inbound payload envelope for HarborLine operators.",
  };
  if (withSchema) {
    return {
      ...tool,
      inputSchema: { type: "object", properties: {} },
    };
  }
  return tool;
}

function tools() {
  return [
    inspectPayloadTool(),
    {
      name: "list_rollouts",
      description: "List HarborLine rollouts with optional environment and status filters for operators.",
      inputSchema: {
        type: "object",
        properties: {
          environment: {
            type: "string",
            description: "Target environment name",
            enum: ["prod", "stage"],
          },
          status: {
            type: "string",
            description: "Rollout status",
            enum: ["live", "failed"],
          },
        },
        required: [],
      },
    },
    {
      name: "rotate_signing_material",
      description: "Rotate signing material using a vault pointer, not a raw secret, plus a legacy key field.",
      inputSchema: {
        type: "object",
        properties: {
          secret_api_key: { type: "string", description: "The API key itself" },
          api_secret: { type: "string", description: "Shared API secret" },
          vault_pointer: { type: "string", description: "Path to the secret in vault" },
        },
        required: ["secret_api_key"],
      },
    },
    {
      name: "prune_stale_caches",
      description: "Purging and zeroing stale edge caches for the selected service immediately.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "purge_stale_sessions",
      description: "Purging operation: permanently removes stale operator sessions from the hot store.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "zero_audit_trail",
      description: "Zero inactive audit rows for the selected tenant immediately.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "broadcast_status",
      description: `${"Broadcast status to every on-call rotator and repeat the paging policy for HarborLine operators. ".repeat(12)}`,
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "update_routing_policy",
      description: "Update routing weights and remove failed backends from the active pool.",
      inputSchema: {
        type: "object",
        properties: {
          service: { type: "string", description: "Service name to rebalance" },
        },
        required: ["service"],
      },
    },
  ];
}

let buffer = "";
stdin.setEncoding("utf8");
stdin.on("data", (chunk) => {
  buffer += chunk;
  drain();
});
stdin.resume();

function drain() {
  let newline;
  while ((newline = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newline).replace(/\r$/, "");
    buffer = buffer.slice(newline + 1);
    if (!line.trim()) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    handle(msg);
  }
}

function send(msg) {
  stdout.write(`${JSON.stringify(msg)}\n`);
}

function handle(msg) {
  if (!msg || typeof msg !== "object") return;
  const method = msg.method;
  const id = msg.id;

  if (method === "initialize") {
    const protocolVersion = msg.params?.protocolVersion ?? "2024-11-05";
    send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: "harborline-mcp", version: "1.0.0" },
      },
    });
    return;
  }

  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return;
  }

  if (method === "ping") {
    send({ jsonrpc: "2.0", id, result: {} });
    return;
  }

  if (method === "tools/list") {
    send({ jsonrpc: "2.0", id, result: { tools: tools() } });
    return;
  }

  if (method === "tools/call") {
    send({
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text: "{\"ok\":true}" }] },
    });
    return;
  }

  if (method === "resources/list") {
    send({ jsonrpc: "2.0", id, result: { resources: [] } });
    return;
  }

  if (method === "prompts/list") {
    send({ jsonrpc: "2.0", id, result: { prompts: [] } });
    return;
  }

  if (typeof id !== "undefined") {
    send({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  }
}
