import type { CliConfig, CliFlags, CliStoragePaths, LoadedCliConfig } from './types.js';
export declare const assertValidRange: (value: string) => string;
export declare const normalizeBaseUrl: (value: string) => string;
export declare const loadConfigState: () => Promise<LoadedCliConfig>;
export declare const saveConfig: (params: {
    config: CliConfig;
    configPath: string;
}) => Promise<void>;
export declare const clearConfig: (configPath: string) => Promise<void>;
export declare const switchStorageDir: (params: {
    config: CliConfig;
    currentPaths: CliStoragePaths;
    nextStorageDir: string;
}) => Promise<LoadedCliConfig>;
export declare const resolveApiKey: (params: {
    config: CliConfig;
    flags: CliFlags;
}) => string | null;
export declare const resolveBaseUrl: (params: {
    config: CliConfig;
    flags: CliFlags;
}) => string;
export declare const resolveRange: (params: {
    config: CliConfig;
    flags: CliFlags;
}) => string;
export declare const updateConfigFromSet: (params: {
    config: CliConfig;
    key: string;
    value: string;
}) => CliConfig;
