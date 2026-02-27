import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import {
    CONFIG_PATH as CLI_CONFIG_PATH,
    CONFIG_DIR,
    DEFAULT_BASE_URL,
    RANGE_ABSOLUTE_REGEX,
    RANGE_VALUES,
    TRAILING_SLASHES_REGEX,
} from './constants.js';
import { failWith } from './errors.js';
import type { CliConfig, CliFlags } from './types.js';

const toOptionalTrimmed = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const isValidRange = (value: string): boolean => {
    return (
        RANGE_VALUES.includes(value as (typeof RANGE_VALUES)[number]) ||
        RANGE_ABSOLUTE_REGEX.test(value)
    );
};

export const assertValidRange = (value: string): string => {
    const trimmed = value.trim();

    if (!isValidRange(trimmed)) {
        failWith({
            code: 'BAD_REQUEST',
            message: 'Range must be 7d, 30d, 90d, or YYYY-MM-DD..YYYY-MM-DD.',
        });
    }

    return trimmed;
};

export const normalizeBaseUrl = (value: string): string => {
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

export const loadConfig = async (): Promise<CliConfig> => {
    try {
        const raw = await readFile(CLI_CONFIG_PATH, 'utf8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        return {
            apiKey:
                typeof parsed.apiKey === 'string' ? toOptionalTrimmed(parsed.apiKey) : undefined,
            baseUrl:
                typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim().length > 0
                    ? normalizeBaseUrl(parsed.baseUrl)
                    : undefined,
            range:
                typeof parsed.range === 'string' && parsed.range.trim().length > 0
                    ? assertValidRange(parsed.range)
                    : undefined,
        };
    } catch (error) {
        if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            (error as { code?: string }).code === 'ENOENT'
        ) {
            return {};
        }

        failWith({
            code: 'INTERNAL_ERROR',
            message: 'Failed to read CLI config.',
            details: { path: CLI_CONFIG_PATH },
        });

        throw new Error('Unreachable');
    }
};

export const saveConfig = async (config: CliConfig): Promise<void> => {
    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(CLI_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
};

export const clearConfig = async (): Promise<void> => {
    await rm(CLI_CONFIG_PATH, { force: true });
};

export const resolveApiKey = (params: { config: CliConfig; flags: CliFlags }): string | null => {
    const fromFlag = toOptionalTrimmed(params.flags.apiKey);
    const fromEnv = toOptionalTrimmed(process.env.ETSYSENTRY_API_KEY);
    const fromConfig = toOptionalTrimmed(params.config.apiKey);

    return fromFlag ?? fromEnv ?? fromConfig ?? null;
};

export const resolveBaseUrl = (params: { config: CliConfig; flags: CliFlags }): string => {
    const fromFlag = toOptionalTrimmed(params.flags.baseUrl);
    const fromEnv = toOptionalTrimmed(process.env.ETSYSENTRY_API_BASE_URL);
    const fromConfig = toOptionalTrimmed(params.config.baseUrl);

    return normalizeBaseUrl(fromFlag ?? fromEnv ?? fromConfig ?? DEFAULT_BASE_URL);
};

export const resolveRange = (params: { config: CliConfig; flags: CliFlags }): string => {
    const fromFlag = toOptionalTrimmed(params.flags.range);
    const fromEnv = toOptionalTrimmed(process.env.ETSYSENTRY_DEFAULT_RANGE);
    const fromConfig = toOptionalTrimmed(params.config.range);

    return assertValidRange(fromFlag ?? fromEnv ?? fromConfig ?? '30d');
};

export const updateConfigFromSet = (params: {
    config: CliConfig;
    key: string;
    value: string;
}): CliConfig => {
    const nextConfig: CliConfig = {
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
