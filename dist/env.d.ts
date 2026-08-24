export declare const EVAL_ENV_KEYS: readonly ["OPENROUTER_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN", "OLLAMA_HOST"];
export interface LoadEvalEnvironmentOptions {
    cwd?: string;
    home?: string;
    env?: NodeJS.ProcessEnv;
    envFile?: string;
}
export interface LoadedEvalEnvironment {
    loadedFrom: string[];
    loadedKeys: string[];
}
export declare function defaultEvalEnvPath(home?: string): string;
/**
 * Load eval credentials without overriding exported environment variables.
 *
 * Precedence:
 * 1. Existing process environment
 * 2. --env-file / MCP_DOCTOR_ENV_FILE (when explicitly selected)
 * 3. ./.env.local
 * 4. ~/.config/mcp-doctor/evaluation.env
 */
export declare function loadEvalEnvironment(options?: LoadEvalEnvironmentOptions): LoadedEvalEnvironment;
/** Backward-compatible helper for callers that only want ./.env.local. */
export declare function loadEnvLocal(cwd?: string): void;
