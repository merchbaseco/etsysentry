export interface CliConfig {
    baseUrl?: string;
}

export interface CliGlobalConfig {
    storageDir?: string;
}

export type CliAuthSource = 'env' | 'flag' | 'secure-store';

export type CliSecureStoreKind = 'macos-keychain' | 'unsupported';

export interface CliSecureStoreStatus {
    available: boolean;
    kind: CliSecureStoreKind;
    reason?: string;
}

export interface ResolvedCliAuth {
    apiKey: string;
    source: CliAuthSource;
    store: CliSecureStoreStatus;
}

export interface CliAuthStatus {
    activeSource: CliAuthSource | null;
    authenticated: boolean;
    hasEnvOverride: boolean;
    hasStoredApiKey: boolean;
    store: CliSecureStoreStatus;
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
    version: boolean;
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
      }
    | {
          type: 'text';
          text: string;
      };
