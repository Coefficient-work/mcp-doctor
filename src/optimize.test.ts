import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadOpenApi } from "./load.js";
import { operationsFromDoc } from "./openapi.js";
import { defaultOptimize } from "./optimize.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("demo fixture loads and optimizes with >=40% reduction", async () => {
  const fixture = join(__dirname, "..", "fixtures", "bloated-platform-api.json");
  const doc = await loadOpenApi(fixture);
  const tools = operationsFromDoc(doc);
  assert.ok(tools.length >= 20);
  const result = defaultOptimize(tools);
  assert.ok(result.reductionPct >= 40);
  assert.ok(result.tools.length < tools.length);
});

test("group-by-tag tools expose children", async () => {
  const fixture = join(__dirname, "..", "fixtures", "bloated-platform-api.json");
  const doc = await loadOpenApi(fixture);
  const result = defaultOptimize(operationsFromDoc(doc));
  const withChildren = result.tools.filter((t) => t.children && t.children.length > 0);
  assert.ok(withChildren.length >= 1);
});

test("demo fixture file exists in package", async () => {
  const fixture = join(__dirname, "..", "fixtures", "bloated-platform-api.json");
  const raw = await readFile(fixture, "utf8");
  assert.ok(raw.includes("openapi"));
});
