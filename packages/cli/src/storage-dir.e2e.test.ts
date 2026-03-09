import { afterEach, describe, expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

interface CliSuccessEnvelope<T> {
    data: T;
    ok: true;
}

interface ConfigCommandData {
    config: {
        baseUrl?: string;
    };
    path: string;
    storageDir: string;
}

const packageRoot = path.resolve(import.meta.dir, '..');
const cliEntrypoint = path.join(packageRoot, 'src/index.ts');
const tempPaths: string[] = [];

const runCli = (
    args: string[],
    homeDir: string,
    envOverrides?: Record<string, string>
): Promise<{
    exitCode: number;
    stderr: string;
    stdout: string;
}> => {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [cliEntrypoint, ...args], {
            cwd: packageRoot,
            env: {
                ...process.env,
                HOME: homeDir,
                ...envOverrides,
            },
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });
        child.on('error', reject);
        child.on('close', (exitCode) => {
            resolve({
                exitCode: exitCode ?? -1,
                stderr,
                stdout,
            });
        });
    });
};

const parseSuccess = <T>(stdout: string): CliSuccessEnvelope<T> => {
    return JSON.parse(stdout) as CliSuccessEnvelope<T>;
};

afterEach(async () => {
    await Promise.all(
        tempPaths.splice(0).map(async (tempPath) => {
            await rm(tempPath, { force: true, recursive: true });
        })
    );
});

describe('storage-dir config e2e', () => {
    test('persists the storage dir globally and preserves config across switches', async () => {
        const homeDir = await mkdtemp(path.join(tmpdir(), 'etsysentry-cli-home-'));
        const firstStorageDir = path.join(homeDir, 'custom-storage-one');
        const secondStorageDir = path.join(homeDir, 'custom-storage-two');
        tempPaths.push(homeDir);

        const setBaseUrlResult = await runCli(
            ['config', 'set', 'base-url', 'http://localhost:8181///'],
            homeDir
        );
        expect(setBaseUrlResult.exitCode).toBe(0);

        const switchFirstResult = await runCli(
            ['config', 'set', 'storage-dir', firstStorageDir],
            homeDir
        );
        expect(switchFirstResult.exitCode).toBe(0);

        const firstEnvelope = parseSuccess<ConfigCommandData>(switchFirstResult.stdout);
        expect(firstEnvelope.data.storageDir).toBe(firstStorageDir);
        expect(firstEnvelope.data.path).toBe(path.join(firstStorageDir, 'config.json'));
        expect(firstEnvelope.data.config).toEqual({
            baseUrl: 'http://localhost:8181',
        });

        const globalSettings = JSON.parse(
            await readFile(path.join(homeDir, '.etsysentry', 'settings.json'), 'utf8')
        ) as {
            storageDir: string;
        };
        expect(globalSettings.storageDir).toBe(firstStorageDir);

        const firstStorageConfig = JSON.parse(
            await readFile(path.join(firstStorageDir, 'config.json'), 'utf8')
        ) as ConfigCommandData['config'];
        expect(firstStorageConfig).toEqual({
            baseUrl: 'http://localhost:8181',
        });

        const updateBaseUrlResult = await runCli(
            ['config', 'set', 'base-url', 'http://localhost:8787///'],
            homeDir
        );
        expect(updateBaseUrlResult.exitCode).toBe(0);

        const switchSecondResult = await runCli(
            ['config', 'set', 'storage-dir', secondStorageDir],
            homeDir
        );
        expect(switchSecondResult.exitCode).toBe(0);

        const secondEnvelope = parseSuccess<ConfigCommandData>(switchSecondResult.stdout);
        expect(secondEnvelope.data.storageDir).toBe(secondStorageDir);
        expect(secondEnvelope.data.config).toEqual({
            baseUrl: 'http://localhost:8787',
        });

        const showResult = await runCli(['config', 'show'], homeDir);
        expect(showResult.exitCode).toBe(0);

        const showEnvelope = parseSuccess<ConfigCommandData>(showResult.stdout);
        expect(showEnvelope.data.storageDir).toBe(secondStorageDir);
        expect(showEnvelope.data.path).toBe(path.join(secondStorageDir, 'config.json'));
        expect(showEnvelope.data.config).toEqual({
            baseUrl: 'http://localhost:8787',
        });

        const secondStorageConfigPath = path.join(secondStorageDir, 'config.json');
        expect((await stat(secondStorageConfigPath)).isFile()).toBe(true);
    });

    test('uses ES_STORAGE_DIR as a non-persistent override', async () => {
        const homeDir = await mkdtemp(path.join(tmpdir(), 'etsysentry-cli-home-'));
        const persistedStorageDir = path.join(homeDir, 'persisted-storage');
        const envStorageDir = path.join(homeDir, 'env-storage');
        tempPaths.push(homeDir);

        const setPersistedDirResult = await runCli(
            ['config', 'set', 'storage-dir', persistedStorageDir],
            homeDir
        );
        expect(setPersistedDirResult.exitCode).toBe(0);

        const setPersistedBaseUrlResult = await runCli(
            ['config', 'set', 'base-url', 'http://localhost:1111'],
            homeDir
        );
        expect(setPersistedBaseUrlResult.exitCode).toBe(0);

        const envOverrideResult = await runCli(
            ['config', 'set', 'base-url', 'http://localhost:2222'],
            homeDir,
            {
                ES_STORAGE_DIR: envStorageDir,
            }
        );
        expect(envOverrideResult.exitCode).toBe(0);

        const envEnvelope = parseSuccess<ConfigCommandData>(envOverrideResult.stdout);
        expect(envEnvelope.data.storageDir).toBe(envStorageDir);
        expect(envEnvelope.data.path).toBe(path.join(envStorageDir, 'config.json'));
        expect(envEnvelope.data.config).toEqual({
            baseUrl: 'http://localhost:2222',
        });

        const globalSettings = JSON.parse(
            await readFile(path.join(homeDir, '.etsysentry', 'settings.json'), 'utf8')
        ) as {
            storageDir: string;
        };
        expect(globalSettings.storageDir).toBe(persistedStorageDir);

        const persistedShowResult = await runCli(['config', 'show'], homeDir);
        expect(persistedShowResult.exitCode).toBe(0);

        const persistedEnvelope = parseSuccess<ConfigCommandData>(persistedShowResult.stdout);
        expect(persistedEnvelope.data.storageDir).toBe(persistedStorageDir);
        expect(persistedEnvelope.data.config).toEqual({
            baseUrl: 'http://localhost:1111',
        });
    });
});
