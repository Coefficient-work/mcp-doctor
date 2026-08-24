import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defaultEvalEnvPath, loadEvalEnvironment } from "./env.js";

function fixture(): { root: string; cwd: string; home: string } {
  const root = mkdtempSync(join(tmpdir(), "mcp-doctor-env-"));
  const cwd = join(root, "work");
  const home = join(root, "home");
  mkdirSync(cwd, { recursive: true });
  mkdirSync(join(home, ".config", "mcp-doctor"), { recursive: true });
  return { root, cwd, home };
}

function writePrivate(path: string, body: string): void {
  writeFileSync(path, body, { mode: 0o600 });
  chmodSync(path, 0o600);
}

describe("loadEvalEnvironment", () => {
  it("loads the per-user eval file from any working directory", () => {
    const { cwd, home } = fixture();
    writePrivate(defaultEvalEnvPath(home), "OPENROUTER_API_KEY=sk-or-test\n");
    const env: NodeJS.ProcessEnv = {};

    const result = loadEvalEnvironment({ cwd, home, env });

    assert.equal(env.OPENROUTER_API_KEY, "sk-or-test");
    assert.deepEqual(result.loadedFrom, [defaultEvalEnvPath(home)]);
    assert.deepEqual(result.loadedKeys, ["OPENROUTER_API_KEY"]);
  });

  it("keeps exported variables and lets .env.local fill before the user file", () => {
    const { cwd, home } = fixture();
    writeFileSync(join(cwd, ".env.local"), "OPENAI_API_KEY=local-openai\n");
    writePrivate(
      defaultEvalEnvPath(home),
      "OPENAI_API_KEY=user-openai\nANTHROPIC_API_KEY=user-anthropic\n",
    );
    const env: NodeJS.ProcessEnv = { OPENROUTER_API_KEY: "exported-router" };

    loadEvalEnvironment({ cwd, home, env });

    assert.equal(env.OPENROUTER_API_KEY, "exported-router");
    assert.equal(env.OPENAI_API_KEY, "local-openai");
    assert.equal(env.ANTHROPIC_API_KEY, "user-anthropic");
  });

  it("uses an explicit private file without falling through to other files", () => {
    const { root, cwd, home } = fixture();
    const selected = join(root, "selected.env");
    writePrivate(selected, "export OPENROUTER_API_KEY='selected-router'\n");
    writeFileSync(join(cwd, ".env.local"), "OPENAI_API_KEY=local-openai\n");
    const env: NodeJS.ProcessEnv = { MCP_DOCTOR_ENV_FILE: selected };

    const result = loadEvalEnvironment({ cwd, home, env });

    assert.equal(env.OPENROUTER_API_KEY, "selected-router");
    assert.equal(env.OPENAI_API_KEY, undefined);
    assert.deepEqual(result.loadedFrom, [selected]);
  });

  it("refuses a group- or world-readable user credential file", () => {
    const { cwd, home } = fixture();
    const path = defaultEvalEnvPath(home);
    writeFileSync(path, "OPENROUTER_API_KEY=sk-or-test\n", { mode: 0o644 });
    chmodSync(path, 0o644);

    assert.throws(
      () => loadEvalEnvironment({ cwd, home, env: {} }),
      /must be private \(chmod 600\)/,
    );
  });

  it("does not execute or interpolate shell syntax", () => {
    const { cwd, home } = fixture();
    writePrivate(
      defaultEvalEnvPath(home),
      "OPENROUTER_API_KEY='$(echo should-not-run)'\nUNRELATED_SECRET=ignored\n",
    );
    const env: NodeJS.ProcessEnv = {};

    loadEvalEnvironment({ cwd, home, env });

    assert.equal(env.OPENROUTER_API_KEY, "$(echo should-not-run)");
    assert.equal(env.UNRELATED_SECRET, undefined);
  });

  it("fails clearly when an explicitly selected file is missing", () => {
    const { root, cwd, home } = fixture();
    const missing = join(root, "missing.env");

    assert.throws(
      () => loadEvalEnvironment({ cwd, home, env: {}, envFile: missing }),
      /eval environment file not found/,
    );
  });
});
