import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeFriction,
  formatFrictionReport,
  formatReplayTimeline,
  type ReplayEvent,
} from "./friction.js";

function successfulEvents(callCount: number): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  let step = 0;
  for (let i = 0; i < callCount; i += 1) {
    events.push({
      step: ++step,
      type: "tool_call",
      toolName: "list_records",
      summary: "Call list_records",
      detail: JSON.stringify({ page: i + 1 }),
    });
    events.push({
      step: ++step,
      type: "tool_result",
      toolName: "list_records",
      summary: "Result from list_records",
      detail: JSON.stringify([{ id: `record-${i + 1}` }]),
    });
  }
  return events;
}

describe("computeFriction", () => {
  it("reports one total call and zero additional calls for a single successful result", () => {
    const friction = computeFriction(successfulEvents(1), true);
    assert.equal(friction.toolCalls, 1);
    assert.equal(friction.unnecessaryCalls, 0);
    const report = formatFrictionReport(friction, true);
    assert.match(report, /Tool calls \| 1/);
    assert.match(report, /Additional calls \| 0/);
  });

  it("reports four total calls and three additional calls without changing friction scoring", () => {
    const friction = computeFriction(successfulEvents(4), true);
    assert.equal(friction.toolCalls, 4);
    assert.equal(friction.unnecessaryCalls, 3);
    assert.equal(friction.score, 2.4);
    assert.match(friction.reasons.join("\n"), /3 additional tool call/);
  });
});

describe("formatReplayTimeline", () => {
  it("prints a tool result body once", () => {
    const timeline = formatReplayTimeline(successfulEvents(1));
    assert.equal((timeline.match(/record-1/g) ?? []).length, 1);
    assert.match(timeline, /tool_result.*Result from list_records/);
  });
});
