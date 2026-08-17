import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FIRST_RUN_NOTICE,
  TELEMETRY_INGESTION_ENABLED,
  formatTelemetryStatus,
  loadTelemetryConfig,
  maybeShowFirstRunNotice,
  resolveTelemetryStatus,
  saveTelemetryConfig,
} from "./telemetry.js";

describe("telemetry", () => {
  it("never enables ingestion before the legal gate", () => {
    assert.equal(TELEMETRY_INGESTION_ENABLED, false);
  });

  it("blocks on --no-telemetry and env flags", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-doctor-telemetry-"));
    process.env.MCP_DOCTOR_TELEMETRY_PATH = join(dir, "telemetry.json");
    delete process.env.DO_NOT_TRACK;
    delete process.env.MCP_DOCTOR_TELEMETRY;

    const flagged = resolveTelemetryStatus({ noTelemetry: true });
    assert.equal(flagged.wouldSend, false);
    assert.equal(flagged.flagBlocked, true);

    process.env.DO_NOT_TRACK = "1";
    const dnt = resolveTelemetryStatus();
    assert.equal(dnt.envBlocked, true);
    assert.equal(dnt.wouldSend, false);
    delete process.env.DO_NOT_TRACK;

    process.env.MCP_DOCTOR_TELEMETRY = "0";
    const env = resolveTelemetryStatus();
    assert.equal(env.envBlocked, true);
    delete process.env.MCP_DOCTOR_TELEMETRY;
    delete process.env.MCP_DOCTOR_TELEMETRY_PATH;
  });

  it("writes a first-run notice without sending events", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-doctor-telemetry-"));
    process.env.MCP_DOCTOR_TELEMETRY_PATH = join(dir, "telemetry.json");
    const lines: string[] = [];
    maybeShowFirstRunNotice((msg) => lines.push(msg));
    assert.match(lines.join("\n"), /Ingestion is currently off/);
    assert.match(FIRST_RUN_NOTICE, /never sends MCP names/);
    const saved = JSON.parse(readFileSync(join(dir, "telemetry.json"), "utf8")) as {
      noticeShownAt?: string;
    };
    assert.ok(saved.noticeShownAt);
    const again: string[] = [];
    maybeShowFirstRunNotice((msg) => again.push(msg));
    assert.equal(again.length, 0);
    delete process.env.MCP_DOCTOR_TELEMETRY_PATH;
  });

  it("status explains gated ingestion", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-doctor-telemetry-"));
    process.env.MCP_DOCTOR_TELEMETRY_PATH = join(dir, "telemetry.json");
    saveTelemetryConfig({ preference: "enabled" });
    const status = resolveTelemetryStatus();
    assert.equal(loadTelemetryConfig().preference, "enabled");
    assert.equal(status.wouldSend, false);
    assert.match(formatTelemetryStatus(status), /ingestion: off/);
    delete process.env.MCP_DOCTOR_TELEMETRY_PATH;
  });
});
