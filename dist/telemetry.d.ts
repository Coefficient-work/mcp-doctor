/** Ingestion stays off until the legal operator and privacy notice are verified. */
export declare const TELEMETRY_INGESTION_ENABLED = false;
export type TelemetryPreference = "unset" | "enabled" | "disabled";
export type TelemetryConfig = {
    preference: TelemetryPreference;
    noticeShownAt?: string;
};
export type TelemetryStatus = {
    preference: TelemetryPreference;
    envBlocked: boolean;
    flagBlocked: boolean;
    ingestionEnabled: boolean;
    wouldSend: boolean;
    configPath: string;
    reason: string;
};
export declare function telemetryConfigPath(): string;
export declare function envBlocksTelemetry(): boolean;
export declare function loadTelemetryConfig(path?: string): TelemetryConfig;
export declare function saveTelemetryConfig(config: TelemetryConfig, path?: string): void;
export declare function resolveTelemetryStatus(opts?: {
    noTelemetry?: boolean;
}): TelemetryStatus;
export declare const FIRST_RUN_NOTICE: string;
export declare function maybeShowFirstRunNotice(write?: (msg: string) => void): void;
export declare function formatTelemetryStatus(status: TelemetryStatus): string;
export declare function setTelemetryPreference(preference: "enabled" | "disabled"): TelemetryConfig;
/** No network. Kept so call sites exist before the legal gate opens. */
export declare function recordTelemetryEvent(_event: {
    command: string;
    outcome: "success" | "error" | "skipped";
}): Promise<void>;
