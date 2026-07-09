import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { OpenApiDocument } from "./openapi.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadOpenApi(spec: string): Promise<OpenApiDocument> {
  const raw = await readSpecRaw(spec);
  const doc =
    spec.endsWith(".yaml") || spec.endsWith(".yml")
      ? (parseYaml(raw) as OpenApiDocument)
      : (JSON.parse(raw) as OpenApiDocument);
  if (!doc.paths) {
    throw new Error("OpenAPI document has no paths");
  }
  return doc;
}

async function readSpecRaw(spec: string): Promise<string> {
  if (spec.startsWith("http://") || spec.startsWith("https://")) {
    const res = await fetch(spec);
    if (!res.ok) {
      throw new Error(`Failed to fetch OpenAPI spec: ${res.status} ${res.statusText}`);
    }
    return res.text();
  }
  return readFile(spec, "utf8");
}

/** Bundled demo fixture shipped with the package. */
export function demoFixturePath(): string {
  return join(__dirname, "..", "fixtures", "bloated-platform-api.json");
}
