import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_BASE_URL, RANGE_ABSOLUTE_REGEX, RANGE_VALUES, TRAILING_SLASHES_REGEX, } from './constants.js';
import { failWith } from './errors.js';
import { resolveConfigPath, resolveStoragePaths, saveStorageDir } from './storage.js';
const toOptionalTrimmed = (value) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
};
const isValidRange = (value) => {
    return (RANGE_VALUES.includes(value) ||
        RANGE_ABSOLUTE_REGEX.test(value));
};
export const assertValidRange = (value) => {
    const trimmed = value.trim();
    if (!isValidRange(trimmed)) {
        failWith({
            code: 'BAD_REQUEST',
            message: 'Range must be 7d, 30d, 90d, or YYYY-MM-DD..YYYY-MM-DD.',
        });
    }
    return trimmed;
};
export const normalizeBaseUrl = (value) => {
    const trimmed = value.trim();
    const normalized = trimmed.replace(TRAILING_SLASHES_REGEX, '');
    if (!normalized) {
        failWith({
            code: 'BAD_REQUEST',
            message: 'Base URL cannot be empty.',
        });
    }
    return normalized;
};
const loadConfigFile = async (configPath) => {
    try {
        const raw = await readFile(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            baseUrl: typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim().length > 0
                ? normalizeBaseUrl(parsed.baseUrl)
                : undefined,
        };
    }
    catch (error) {
        if (error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'ENOENT') {
            return {};
        }
        failWith({
            code: 'INTERNAL_ERROR',
            message: 'Failed to read CLI config.',
            details: { path: configPath },
        });
        throw new Error('Unreachable');
    }
};
export const loadConfigState = async () => {
    const paths = await resolveStoragePaths();
    const config = await loadConfigFile(paths.configPath);
    return {
        config,
        paths,
    };
};
export const saveConfig = async (params) => {
    await mkdir(path.dirname(params.configPath), { recursive: true });
    await writeFile(params.configPath, `${JSON.stringify(params.config, null, 2)}\n`, 'utf8');
};
export const clearConfig = async (configPath) => {
    await rm(configPath, { force: true });
};
export const switchStorageDir = async (params) => {
    const nextConfigPath = resolveConfigPath(params.nextStorageDir);
    const existingConfig = await loadConfigFile(nextConfigPath);
    const nextConfig = {
        ...existingConfig,
        ...params.config,
    };
    await saveConfig({
        config: nextConfig,
        configPath: nextConfigPath,
    });
    await saveStorageDir(params.nextStorageDir);
    return {
        config: nextConfig,
        paths: {
            configPath: nextConfigPath,
            globalConfigPath: params.currentPaths.globalConfigPath,
            storageDir: params.nextStorageDir,
        },
    };
};
export const resolveBaseUrl = (params) => {
    const fromFlag = toOptionalTrimmed(params.flags.baseUrl);
    const fromEnv = toOptionalTrimmed(process.env.ES_BASE_URL);
    const fromConfig = toOptionalTrimmed(params.config.baseUrl);
    return normalizeBaseUrl(fromFlag ?? fromEnv ?? fromConfig ?? DEFAULT_BASE_URL);
};
export const resolveRange = (rangeFlag) => {
    const fromFlag = toOptionalTrimmed(rangeFlag);
    return assertValidRange(fromFlag ?? '30d');
};
export const updateConfigFromSet = (params) => {
    const nextConfig = {
        ...params.config,
    };
    if (params.key === 'base-url') {
        nextConfig.baseUrl = normalizeBaseUrl(params.value);
        return nextConfig;
    }
    failWith({
        code: 'BAD_REQUEST',
        message: 'Unsupported config key.',
        details: {
            key: params.key,
            supportedKeys: ['base-url', 'storage-dir'],
        },
    });
    throw new Error('Unreachable');
};
