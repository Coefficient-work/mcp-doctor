import type { OpenApiDocument } from "./openapi.js";
export declare function loadOpenApi(spec: string): Promise<OpenApiDocument>;
/** Bundled demo fixture shipped with the package. */
export declare function demoFixturePath(): string;
