#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [sandbox, rawModels] = process.argv.slice(2);
if (!sandbox || !rawModels) {
  console.error("Usage: validate-blind-artifacts.mjs <sandbox> <comma-separated-models>");
  process.exit(2);
}

const models = rawModels.split(",").map((model) => model.trim()).filter(Boolean);
const required = [
  "REPORT.md",
  "inspect-before.md",
  "inspect-after.md",
  "eval-before.txt",
  "eval-openrouter-matrix.md",
];
const failures = [];

function readRequired(name) {
  const path = join(sandbox, name);
  if (!existsSync(path)) {
    failures.push(`missing required artifact: ${name}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

const artifacts = Object.fromEntries(required.map((name) => [name, readRequired(name)]));
const before = artifacts["inspect-before.md"];
const after = artifacts["inspect-after.md"];
const evalBefore = artifacts["eval-before.txt"];
const matrix = artifacts["eval-openrouter-matrix.md"];
const combined = Object.values(artifacts).join("\n");

if (!/Grade F/.test(before) || !/missing-input-schema/.test(before)) {
  failures.push("inspect-before.md must show Grade F and missing-input-schema");
}
if (!/missing required inputSchema/.test(evalBefore)) {
  failures.push("eval-before.txt must show human-readable missing inputSchema refusal");
}
if (/Zod|"expected"\s*:\s*"object"/.test(evalBefore)) {
  failures.push("eval-before.txt contains a Zod/schema dump");
}
const afterGrade = after.match(/Grade ([A-F])/i)?.[1]?.toUpperCase();
if (!afterGrade) failures.push("inspect-after.md has no grade");
if (afterGrade === "A") failures.push("inspect-after.md reached Grade A despite retained trust defects");

for (const forbidden of [/copy to Louis/i, /Louis footer/i, /sk-(?:or|proj|ant)-[A-Za-z0-9_-]{8,}/]) {
  if (forbidden.test(combined)) failures.push(`forbidden report content matched ${forbidden}`);
}

for (const model of models) {
  const escaped = model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`\\| ${escaped} \\| pass \\|`).test(matrix)) {
    failures.push(`${model}: compatibility matrix row is not pass`);
  }
  const heading = `### ${model}`;
  const start = matrix.indexOf(heading);
  if (start < 0) {
    failures.push(`${model}: missing report section`);
    continue;
  }
  const laterStarts = models
    .map((candidate) => matrix.indexOf(`### ${candidate}`, start + heading.length))
    .filter((index) => index > start);
  const end = laterStarts.length ? Math.min(...laterStarts) : matrix.length;
  const block = matrix.slice(start, end);
  if (!/MCP execution proven \| Yes/.test(block)) {
    failures.push(`${model}: execution proof is not Yes`);
  }
  const displayed = Number(block.match(/\| Tool calls \| (\d+) \|/)?.[1]);
  const replayCalls = (block.match(/\*\*tool_call\*\*/g) ?? []).length;
  const replayResults = (block.match(/\*\*tool_result\*\*/g) ?? []).length;
  if (!Number.isFinite(displayed) || displayed !== replayCalls) {
    failures.push(`${model}: displayed tool calls ${displayed} != replay calls ${replayCalls}`);
  }
  if (replayResults < 1) failures.push(`${model}: replay has no successful tool result`);
  if (/\*\*tool_result\*\*[^\n]*: (?!Result from )/.test(block)) {
    failures.push(`${model}: tool result still uses the duplicated summary/detail format`);
  }
}

for (const [name, text] of Object.entries(artifacts)) {
  if (/Tools \(live\) \| [1-9]/.test(text) && /Score: 0\/100/.test(text)) {
    failures.push(`${name}: reports 0/100 despite discovered live tools`);
  }
}

const statusPath = join(sandbox, "blind-validation.txt");
if (failures.length > 0) {
  const body = ["FAIL", ...failures.map((failure) => `- ${failure}`)].join("\n") + "\n";
  writeFileSync(statusPath, body, "utf8");
  console.error(body.trim());
  process.exit(1);
}

const body = `PASS\nmodels=${models.join(",")}\n`;
writeFileSync(statusPath, body, "utf8");
console.log(body.trim());
