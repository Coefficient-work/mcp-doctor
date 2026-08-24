import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
export const EVAL_ENV_KEYS = [
    "OPENROUTER_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "AI_GATEWAY_API_KEY",
    "VERCEL_OIDC_TOKEN",
    "OLLAMA_HOST",
];
const evalEnvKeySet = new Set(EVAL_ENV_KEYS);
export function defaultEvalEnvPath(home = homedir()) {
    return resolve(home, ".config", "mcp-doctor", "evaluation.env");
}
function resolveEnvPath(path, cwd) {
    return isAbsolute(path) ? path : resolve(cwd, path);
}
function assertPrivateFile(path) {
    const stat = statSync(path);
    if (!stat.isFile()) {
        throw new Error(`MCP Doctor eval environment path is not a regular file: ${path}`);
    }
    if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) {
        throw new Error(`MCP Doctor eval environment file must be private (chmod 600): ${path}`);
    }
}
function parseEnvFile(path) {
    const parsed = new Map();
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
        let line = lines[index].trim();
        if (!line || line.startsWith("#"))
            continue;
        if (line.startsWith("export "))
            line = line.slice("export ".length).trim();
        const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
        if (!match) {
            throw new Error(`Invalid MCP Doctor eval environment entry at ${path}:${index + 1}; expected NAME=value`);
        }
        const [, key, rawValue] = match;
        if (!evalEnvKeySet.has(key))
            continue;
        let value = rawValue;
        if (value.startsWith('"') || value.startsWith("'")) {
            const quote = value[0];
            if (value.length < 2 || !value.endsWith(quote)) {
                throw new Error(`Unclosed quote in MCP Doctor eval environment entry at ${path}:${index + 1}`);
            }
            value = value.slice(1, -1);
        }
        if (value)
            parsed.set(key, value);
    }
    return parsed;
}
function loadFile(path, target, requirePrivate) {
    if (!existsSync(path))
        return [];
    if (requirePrivate)
        assertPrivateFile(path);
    const loaded = [];
    for (const [key, value] of parseEnvFile(path)) {
        if (target[key] !== undefined)
            continue;
        target[key] = value;
        loaded.push(key);
    }
    return loaded;
}
/**
 * Load eval credentials without overriding exported environment variables.
 *
 * Precedence:
 * 1. Existing process environment
 * 2. --env-file / MCP_DOCTOR_ENV_FILE (when explicitly selected)
 * 3. ./.env.local
 * 4. ~/.config/mcp-doctor/evaluation.env
 */
export function loadEvalEnvironment(options = {}) {
    const cwd = options.cwd ?? process.cwd();
    const home = options.home ?? homedir();
    const target = options.env ?? process.env;
    const selected = options.envFile ?? target.MCP_DOCTOR_ENV_FILE;
    const candidates = selected
        ? [{ path: resolveEnvPath(selected, cwd), required: true, requirePrivate: true }]
        : [
            { path: resolve(cwd, ".env.local"), required: false, requirePrivate: false },
            { path: defaultEvalEnvPath(home), required: false, requirePrivate: true },
        ];
    const loadedFrom = [];
    const loadedKeys = [];
    const seen = new Set();
    for (const candidate of candidates) {
        if (seen.has(candidate.path))
            continue;
        seen.add(candidate.path);
        if (!existsSync(candidate.path)) {
            if (candidate.required) {
                throw new Error(`MCP Doctor eval environment file not found: ${candidate.path}`);
            }
            continue;
        }
        const keys = loadFile(candidate.path, target, candidate.requirePrivate);
        loadedFrom.push(candidate.path);
        loadedKeys.push(...keys);
    }
    return { loadedFrom, loadedKeys };
}
/** Backward-compatible helper for callers that only want ./.env.local. */
export function loadEnvLocal(cwd = process.cwd()) {
    loadFile(resolve(cwd, ".env.local"), process.env, false);
}
