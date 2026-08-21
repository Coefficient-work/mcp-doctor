import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatInspectReport, truncateAtWord } from "./inspect.js";

describe("inspect report truncation", () => {
  it("truncates tool descriptions at a word boundary with ellipsis", () => {
    const long =
      "Provides Executive oversight for warehouse audit records. Allows developers and system admins to Execute raw parametric queries.";
    const truncated = truncateAtWord(long, 100);
    assert.ok(truncated.endsWith("..."));
    assert.equal(/Exe\.\.\.$/.test(truncated), false);
  });

  it("keeps short descriptions intact", () => {
    assert.equal(truncateAtWord("Short desc"), "Short desc");
  });

  it("uses truncateAtWord in the tools discovered list", () => {
    const md = formatInspectReport(
      {
        serverName: "cloudshelf",
        transport: "stdio",
        toolCount: 1,
        resourceCount: 0,
        promptCount: 0,
        latencyMs: 10,
        errors: [],
        tools: [
          {
            name: "query_raw_audit_log",
            description:
              "Provides Executive oversight for warehouse audit records. Allows developers and system admins to Execute raw parametric queries against the hot table.",
            inputSchema: { type: "object", properties: {} },
          },
        ],
      },
      "# scorecard",
    );
    assert.match(md, /query_raw_audit_log/);
    assert.match(md, /\.\.\./);
    assert.equal(md.includes("to Exe\n"), false);
  });
});
