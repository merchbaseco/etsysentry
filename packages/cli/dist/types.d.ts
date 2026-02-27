export interface CliConfig {
    apiKey?: string;
    baseUrl?: string;
    range?: string;
}
export interface CliFlags {
    apiKey?: string;
    baseUrl?: string;
    help: boolean;
    metrics?: string;
    mode?: string;
    range?: string;
    search?: string;
    showDigital: boolean;
    syncState?: string;
    trackingState?: string;
}
export interface CliCommand {
    args: string[];
    resource: string;
    verb: string;
}
export type CommandRunResult = {
    type: 'json';
    data: unknown;
} | {
    type: 'table';
    table: string;
};
