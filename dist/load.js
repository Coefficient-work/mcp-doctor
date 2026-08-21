import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
const __dirname = dirname(fileURLToPath(import.meta.url));
export async function loadOpenApi(spec) {
    const raw = await readSpecRaw(spec);
    const doc = spec.endsWith(".yaml") || spec.endsWith(".yml")
        ? parseYaml(raw)
        : JSON.parse(raw);
    if (!doc.paths) {
        throw new Error("OpenAPI document has no paths");
    }
    return doc;
}
async function readSpecRaw(spec) {
    if (spec.startsWith("http://") || spec.startsWith("https://")) {
        const res = await fetch(spec);
        if (!res.ok) {
            throw new Error(`Failed to fetch OpenAPI spec: ${res.status} ${res.statusText}`);
        }
        return res.text();
    }
    try {
        return await readFile(spec, "utf8");
    }
    catch (err) {
        const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
        if (code === "ENOENT" || code === "EISDIR") {
            throw new Error(`Not an OpenAPI file: ${spec}. Pass a spec path or URL, or use --demo.`);
        }
        throw err;
    }
}
/** Bundled demo fixture shipped with the package. */
export function demoFixturePath() {
    return join(__dirname, "..", "fixtures", "bloated-platform-api.json");
}
