export interface CliConfig {
    baseUrl?: string;
    range?: string;
}

export interface CliGlobalConfig {
    storageDir?: string;
}

export interface CliStoragePaths {
    configPath: string;
    globalConfigPath: string;
    storageDir: string;
}

export interface LoadedCliConfig {
    config: CliConfig;
    paths: CliStoragePaths;
}

export interface CliFlags {
    apiKey?: string;
    baseUrl?: string;
    help: boolean;
    limit?: string;
    metrics?: string;
    mode?: string;
    offset?: string;
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

export type CommandRunResult =
    | {
          type: 'json';
          data: unknown;
      }
    | {
          type: 'table';
          table: string;
      };
