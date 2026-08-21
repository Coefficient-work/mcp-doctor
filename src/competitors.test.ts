import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatCompetitorReport, loadRegistry, publicRegistry } from "./competitors.js";

describe("competitors public map", () => {
  it("never prints strategy, threat, or our-angle columns", () => {
    const registry = loadRegistry();
    const md = formatCompetitorReport(registry);
    assert.match(md, /Overlap/);
    assert.equal(md.includes("Threat"), false);
    assert.equal(md.includes("Our angle"), false);
    const json = JSON.stringify(publicRegistry(registry));
    assert.equal(json.includes("ourAngle"), false);
    assert.equal(json.includes("\"threat\""), false);
  });
});
