import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packageVersion } from "./pkg.js";
import { formatTruncatedList } from "./scorecard.js";
describe("packageVersion", () => {
    it("matches package.json", () => {
        const pkg = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8"));
        assert.equal(packageVersion(), pkg.version);
    });
});
describe("formatTruncatedList", () => {
    it("joins short lists fully and appends +N more when truncated", () => {
        assert.equal(formatTruncatedList(["a", "b"]), "a, b");
        const items = Array.from({ length: 10 }, (_, i) => `t${i}`);
        assert.equal(formatTruncatedList(items), "t0, t1, t2, t3, t4, t5, t6, t7 (+2 more)");
    });
});
