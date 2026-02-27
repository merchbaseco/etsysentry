import { CONFIG_PATH } from './constants.js';
import type { CliConfig, CliFlags } from './types.js';
export declare const assertValidRange: (value: string) => string;
export declare const normalizeBaseUrl: (value: string) => string;
export declare const loadConfig: () => Promise<CliConfig>;
export declare const saveConfig: (config: CliConfig) => Promise<void>;
export declare const clearConfig: () => Promise<void>;
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
export { CONFIG_PATH };
