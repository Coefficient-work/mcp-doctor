import type { OpenApiDocument } from "./openapi.js";
export declare function loadOpenApi(spec: string): Promise<OpenApiDocument>;
/** Bundled demo fixture shipped with the package. */
export declare function demoFixturePath(): string;
export declare function looksLikeMcpServerName(spec: string): boolean;
export declare function requireOpenApiSpec(spec: string | undefined, demo: boolean | undefined, command: string): Promise<string>;
