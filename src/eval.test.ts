import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertEvalAuth } from "./eval.js";

describe("assertEvalAuth", () => {
  const keys = [
    "AI_GATEWAY_API_KEY",
    "VERCEL_OIDC_TOKEN",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "OLLAMA_HOST",
  ] as const;

  function snapshot(): Record<string, string | undefined> {
    const out: Record<string, string | undefined> = {};
    for (const key of keys) out[key] = process.env[key];
    return out;
  }

  function restore(prev: Record<string, string | undefined>): void {
    for (const key of keys) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  }

  it("accepts OPENAI_API_KEY without a gateway key", () => {
    const prev = snapshot();
    try {
      for (const key of keys) delete process.env[key];
      process.env.OPENAI_API_KEY = "sk-test";
      assert.doesNotThrow(() => assertEvalAuth());
    } finally {
      restore(prev);
    }
  });

  it("throws a one-line error when no keys are set", () => {
    const prev = snapshot();
    try {
      for (const key of keys) delete process.env[key];
      assert.throws(() => assertEvalAuth(), /eval needs a model key/);
    } finally {
      restore(prev);
    }
  });
});
