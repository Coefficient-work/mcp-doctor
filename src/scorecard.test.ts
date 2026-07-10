import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { operationsFromDoc } from "./openapi.js";
import { runScorecard } from "./scorecard.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../fixtures/bloated-platform-api.json"), "utf8"),
);

describe("runScorecard", () => {
  it("flags bloated demo API with warnings or failures", () => {
    const tools = operationsFromDoc(fixture);
    const result = runScorecard(fixture, tools);
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
