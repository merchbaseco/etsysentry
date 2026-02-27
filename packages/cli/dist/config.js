import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { CONFIG_DIR, CONFIG_PATH, RANGE_ABSOLUTE_REGEX, RANGE_VALUES, TRAILING_SLASHES_REGEX, } from './constants.js';
import { failWith } from './errors.js';
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
export const loadConfig = async () => {
    try {
        const raw = await readFile(CONFIG_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            apiKey: typeof parsed.apiKey === 'string' ? toOptionalTrimmed(parsed.apiKey) : undefined,
            baseUrl: typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim().length > 0
                ? normalizeBaseUrl(parsed.baseUrl)
                : undefined,
            range: typeof parsed.range === 'string' && parsed.range.trim().length > 0
                ? assertValidRange(parsed.range)
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
            details: { path: CONFIG_PATH },
        });
        throw new Error('Unreachable');
    }
};
export const saveConfig = async (config) => {
    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
};
export const clearConfig = async () => {
    await rm(CONFIG_PATH, { force: true });
};
export const resolveApiKey = (params) => {
    const fromFlag = toOptionalTrimmed(params.flags.apiKey);
    const fromEnv = toOptionalTrimmed(process.env.ETSYSENTRY_API_KEY);
    const fromConfig = toOptionalTrimmed(params.config.apiKey);
    return fromFlag ?? fromEnv ?? fromConfig ?? null;
};
export const resolveBaseUrl = (params) => {
    const fromFlag = toOptionalTrimmed(params.flags.baseUrl);
    const fromEnv = toOptionalTrimmed(process.env.ETSYSENTRY_API_BASE_URL);
    const fromConfig = toOptionalTrimmed(params.config.baseUrl);
    return normalizeBaseUrl(fromFlag ?? fromEnv ?? fromConfig ?? 'http://localhost:8080');
};
export const resolveRange = (params) => {
    const fromFlag = toOptionalTrimmed(params.flags.range);
    const fromEnv = toOptionalTrimmed(process.env.ETSYSENTRY_DEFAULT_RANGE);
    const fromConfig = toOptionalTrimmed(params.config.range);
    return assertValidRange(fromFlag ?? fromEnv ?? fromConfig ?? '30d');
};
export const updateConfigFromSet = (params) => {
    const nextConfig = {
        ...params.config,
    };
    if (params.key === 'api-key') {
        nextConfig.apiKey = params.value.trim();
        return nextConfig;
    }
    if (params.key === 'base-url') {
        nextConfig.baseUrl = normalizeBaseUrl(params.value);
        return nextConfig;
    }
    if (params.key === 'range') {
        nextConfig.range = assertValidRange(params.value);
        return nextConfig;
    }
    failWith({
        code: 'BAD_REQUEST',
        message: 'Unsupported config key.',
        details: {
            key: params.key,
            supportedKeys: ['api-key', 'base-url', 'range'],
        },
    });
    throw new Error('Unreachable');
};
export { CONFIG_PATH };
