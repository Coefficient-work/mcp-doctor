import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { looksLikeMcpServerName, requireOpenApiSpec } from "./load.js";

describe("requireOpenApiSpec", () => {
  it("hints inspect when the arg looks like an MCP server name", async () => {
    await assert.rejects(
      () => requireOpenApiSpec("cloudshelf", false, "analyze"),
      /"cloudshelf" is not an OpenAPI file\. For a live MCP server run: mcp-doctor inspect cloudshelf/,
    );
  });

  it("requires a spec or --demo", async () => {
    await assert.rejects(
      () => requireOpenApiSpec(undefined, false, "test"),
      /test needs an OpenAPI spec path\/URL, or --demo/,
    );
  });

  it("does not treat spec files as server names", () => {
    assert.equal(looksLikeMcpServerName("openapi.json"), false);
    assert.equal(looksLikeMcpServerName("https://example.com/spec.yaml"), false);
    assert.equal(looksLikeMcpServerName("cloudshelf"), true);
  });
});
