import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertEvalAuth, evalTaskSucceeded } from "./eval.js";
describe("assertEvalAuth", () => {
    const keys = [
        "AI_GATEWAY_API_KEY",
        "VERCEL_OIDC_TOKEN",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "OLLAMA_HOST",
    ];
    function snapshot() {
        const out = {};
        for (const key of keys)
            out[key] = process.env[key];
        return out;
    }
    function restore(prev) {
        for (const key of keys) {
            if (prev[key] === undefined)
                delete process.env[key];
            else
                process.env[key] = prev[key];
        }
    }
    it("accepts OPENAI_API_KEY without a gateway key", () => {
        const prev = snapshot();
        try {
            for (const key of keys)
                delete process.env[key];
            process.env.OPENAI_API_KEY = "sk-test";
            assert.doesNotThrow(() => assertEvalAuth());
        }
        finally {
            restore(prev);
        }
    });
    it("throws a one-line error when no keys are set", () => {
        const prev = snapshot();
        try {
            for (const key of keys)
                delete process.env[key];
            assert.throws(() => assertEvalAuth(), /eval needs a model key/);
        }
        finally {
            restore(prev);
        }
    });
});
describe("evalTaskSucceeded", () => {
    it("succeeds on stop plus one non-error tool result without magic words", () => {
        assert.equal(evalTaskSucceeded({
            finishReason: "stop",
            events: [
                { step: 1, type: "tool_call", summary: "Call list_shipments", toolName: "list_shipments" },
                { step: 2, type: "tool_result", summary: "SHP-1001 in_transit at HUB-EAST", toolName: "list_shipments" },
                { step: 3, type: "assistant", summary: "Shipment SHP-1001 is in transit at HUB-EAST." },
            ],
        }), true);
    });
    it("fails when the model never calls a tool", () => {
        assert.equal(evalTaskSucceeded({
            finishReason: "stop",
            events: [{ step: 1, type: "assistant", summary: "I listed the tools." }],
        }), false);
    });
    it("passes the 0.4.4 regression when a correct result ends with tool-calls", () => {
        assert.equal(evalTaskSucceeded({
            finishReason: "tool-calls",
            events: [
                { step: 1, type: "tool_call", summary: "Call get_shipment", toolName: "get_shipment" },
                {
                    step: 2,
                    type: "tool_result",
                    summary: '{"id":"SHP-1001","status":"in_transit"}',
                    toolName: "get_shipment",
                },
            ],
        }), true);
    });
    it("does not buy success with a tool call that produced no result", () => {
        assert.equal(evalTaskSucceeded({
            finishReason: "stop",
            events: [
                { step: 1, type: "tool_call", summary: "Call get_shipment", toolName: "get_shipment" },
                { step: 2, type: "assistant", summary: "The shipment is probably in transit." },
            ],
        }), false);
    });
    it("fails when every tool result is an error", () => {
        assert.equal(evalTaskSucceeded({
            finishReason: "stop",
            events: [
                { step: 1, type: "tool_call", summary: "Call list_shipments", toolName: "list_shipments" },
                {
                    step: 2,
                    type: "tool_result",
                    summary: "unauthorized",
                    toolName: "list_shipments",
                    isError: true,
                },
            ],
        }), false);
    });
});
