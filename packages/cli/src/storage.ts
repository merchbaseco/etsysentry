import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { CONFIG_FILENAME, DEFAULT_STORAGE_DIR, GLOBAL_CONFIG_PATH } from './constants.js';
import { failWith } from './errors.js';
import type { CliGlobalConfig, CliStoragePaths } from './types.js';

const toOptionalTrimmed = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const expandHomeDirectory = (value: string): string => {
    if (value === '~') {
        return homedir();
    }

    if (value.startsWith('~/')) {
        return path.join(homedir(), value.slice(2));
    }

    return value;
};

export const normalizeStorageDir = (value: string): string => {
    const trimmed = toOptionalTrimmed(value);

    if (trimmed !== undefined) {
        return path.resolve(expandHomeDirectory(trimmed));
    }

    failWith({
        code: 'BAD_REQUEST',
        message: 'Storage directory cannot be empty.',
    });

    throw new Error('Unreachable');
};

export const resolveConfigPath = (storageDir: string): string => {
    return path.join(storageDir, CONFIG_FILENAME);
};

export const loadGlobalConfig = async (): Promise<CliGlobalConfig> => {
    try {
        const raw = await readFile(GLOBAL_CONFIG_PATH, 'utf8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        return {
            storageDir:
                typeof parsed.storageDir === 'string'
                    ? normalizeStorageDir(parsed.storageDir)
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
            message: 'Failed to read CLI global config.',
            details: { path: GLOBAL_CONFIG_PATH },
        });

        throw new Error('Unreachable');
    }
};

export const saveGlobalConfig = async (config: CliGlobalConfig): Promise<void> => {
    await mkdir(DEFAULT_STORAGE_DIR, { recursive: true });
    await writeFile(GLOBAL_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
};

export const saveStorageDir = async (storageDir: string): Promise<void> => {
    const normalizedStorageDir = normalizeStorageDir(storageDir);

    if (normalizedStorageDir === DEFAULT_STORAGE_DIR) {
        await saveGlobalConfig({});
        return;
    }

    await saveGlobalConfig({
        storageDir: normalizedStorageDir,
    });
};

export const resolveStoragePaths = async (): Promise<CliStoragePaths> => {
    const globalConfig = await loadGlobalConfig();
    const storageDir = globalConfig.storageDir ?? DEFAULT_STORAGE_DIR;

    return {
        configPath: resolveConfigPath(storageDir),
        globalConfigPath: GLOBAL_CONFIG_PATH,
        storageDir,
    };
};
