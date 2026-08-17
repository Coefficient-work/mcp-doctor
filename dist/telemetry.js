import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { NPM_PACKAGE, SITE_URL } from "./brand.js";
/** Ingestion stays off until the legal operator and privacy notice are verified. */
export const TELEMETRY_INGESTION_ENABLED = false;
const DEFAULT_CONFIG = { preference: "unset" };
export function telemetryConfigPath() {
    return process.env.MCP_DOCTOR_TELEMETRY_PATH ?? join(homedir(), ".mcp-doctor", "telemetry.json");
}
export function envBlocksTelemetry() {
    const dnt = process.env.DO_NOT_TRACK;
    if (dnt === "1" || dnt === "true")
        return true;
    const flag = process.env.MCP_DOCTOR_TELEMETRY;
    if (flag === "0" || flag === "false")
        return true;
    return false;
}
export function loadTelemetryConfig(path = telemetryConfigPath()) {
    try {
        if (!existsSync(path))
            return { ...DEFAULT_CONFIG };
        const parsed = JSON.parse(readFileSync(path, "utf8"));
        const preference = parsed.preference === "enabled" || parsed.preference === "disabled" || parsed.preference === "unset"
            ? parsed.preference
            : "unset";
        return {
            preference,
            noticeShownAt: typeof parsed.noticeShownAt === "string" ? parsed.noticeShownAt : undefined,
        };
    }
    catch {
        return { ...DEFAULT_CONFIG };
    }
}
export function saveTelemetryConfig(config, path = telemetryConfigPath()) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
export function resolveTelemetryStatus(opts = {}) {
    const configPath = telemetryConfigPath();
    const config = loadTelemetryConfig(configPath);
    const envBlocked = envBlocksTelemetry();
    const flagBlocked = Boolean(opts.noTelemetry);
    const ingestionEnabled = TELEMETRY_INGESTION_ENABLED;
    const preference = config.preference;
    let reason = "ingestion gated off until operator and privacy notice are verified";
    if (flagBlocked)
        reason = "--no-telemetry";
    else if (envBlocked)
        reason = "DO_NOT_TRACK or MCP_DOCTOR_TELEMETRY=0";
    else if (preference === "disabled")
        reason = "telemetry disable preference";
    const wouldSend = ingestionEnabled && !flagBlocked && !envBlocked && preference !== "disabled";
    return {
        preference,
        envBlocked,
        flagBlocked,
        ingestionEnabled,
        wouldSend,
        configPath,
        reason,
    };
}
export const FIRST_RUN_NOTICE = [
    `${NPM_PACKAGE} can send anonymous usage after a legal gate: CLI version, command name, outcome, duration bucket, OS family, Node major, and CI flag.`,
    "It never sends MCP names, URLs, paths, prompts, tasks, reports, API keys, or tool definitions.",
    `Ingestion is currently off. See ${SITE_URL}/privacy`,
    "Disable anytime: mcp-doctor telemetry disable",
    "Also honored: DO_NOT_TRACK=1, MCP_DOCTOR_TELEMETRY=0, --no-telemetry",
].join("\n");
export function maybeShowFirstRunNotice(write = console.error) {
    if (process.env.CI === "1" || process.env.CI === "true")
        return;
    if (write === console.error && !process.stderr.isTTY)
        return;
    const path = telemetryConfigPath();
    const config = loadTelemetryConfig(path);
    if (config.noticeShownAt)
        return;
    write(`\n${FIRST_RUN_NOTICE}\n`);
    saveTelemetryConfig({ ...config, noticeShownAt: new Date().toISOString() }, path);
}
export function formatTelemetryStatus(status) {
    return [
        `preference: ${status.preference}`,
        `ingestion: ${status.ingestionEnabled ? "on" : "off"}`,
        `would send: ${status.wouldSend ? "yes" : "no"}`,
        `reason: ${status.reason}`,
        `config: ${status.configPath}`,
    ].join("\n");
}
export function setTelemetryPreference(preference) {
    const current = loadTelemetryConfig();
    const next = { ...current, preference };
    saveTelemetryConfig(next);
    return next;
}
/** No network. Kept so call sites exist before the legal gate opens. */
export async function recordTelemetryEvent(_event) {
    return;
}
