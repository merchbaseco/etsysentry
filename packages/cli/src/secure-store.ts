import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CLI_SECURE_STORE_ACCOUNT, CLI_SECURE_STORE_SERVICE } from './constants.js';
import { failWith } from './errors.js';
import type { CliSecureStoreStatus } from './types.js';

const execFileAsync = promisify(execFile);
const MACOS_MISSING_SECRET_PATTERNS = [
    'could not be found in the keychain',
    'the specified item could not be found in the keychain',
] as const;

interface CommandExecutionError {
    code?: number | string;
    message?: string;
    stderr?: string;
    stdout?: string;
}

interface CommandResult {
    stderr: string;
    stdout: string;
}

type SecureStoreCommandRunner = (file: string, args: string[]) => Promise<CommandResult>;

export interface CliSecureStore {
    clearApiKey(): Promise<boolean>;
    getStatus(): Promise<CliSecureStoreStatus>;
    readApiKey(): Promise<string | null>;
    writeApiKey(apiKey: string): Promise<void>;
}

const toTrimmedValue = (value: string): string => {
    return value.trim();
};

const toCommandErrorMessage = (error: unknown): string => {
    if (!error || typeof error !== 'object') {
        return '';
    }

    const commandError = error as CommandExecutionError;
    return [commandError.stderr, commandError.stdout, commandError.message]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join('\n')
        .toLowerCase();
};

const isMissingSecretError = (error: unknown): boolean => {
    const message = toCommandErrorMessage(error);
    return MACOS_MISSING_SECRET_PATTERNS.some((pattern) => message.includes(pattern));
};

const runSecureStoreCommand: SecureStoreCommandRunner = async (file, args) => {
    const result = await execFileAsync(file, args, {
        encoding: 'utf8',
    });

    return {
        stderr: result.stderr,
        stdout: result.stdout,
    };
};

const getDefaultStoreStatus = (): CliSecureStoreStatus => {
    if (process.platform === 'darwin') {
        return {
            available: true,
            kind: 'macos-keychain',
        };
    }

    return {
        available: false,
        kind: 'unsupported',
        reason: 'Secure auth storage is currently supported on macOS Keychain only.',
    };
};

const createMacOsSecureStore = (runCommand: SecureStoreCommandRunner): CliSecureStore => {
    const getStatus = async (): Promise<CliSecureStoreStatus> => {
        try {
            await runCommand('security', ['list-keychains']);

            return {
                available: true,
                kind: 'macos-keychain',
            };
        } catch {
            return {
                available: false,
                kind: 'macos-keychain',
                reason: 'macOS Keychain is unavailable from this runtime.',
            };
        }
    };

    return {
        clearApiKey: async (): Promise<boolean> => {
            try {
                await runCommand('security', [
                    'delete-generic-password',
                    '-a',
                    CLI_SECURE_STORE_ACCOUNT,
                    '-s',
                    CLI_SECURE_STORE_SERVICE,
                ]);

                return true;
            } catch (error) {
                if (isMissingSecretError(error)) {
                    return false;
                }

                failWith({
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to clear the stored API key from macOS Keychain.',
                });

                throw new Error('Unreachable');
            }
        },
        getStatus,
        readApiKey: async (): Promise<string | null> => {
            try {
                const result = await runCommand('security', [
                    'find-generic-password',
                    '-a',
                    CLI_SECURE_STORE_ACCOUNT,
                    '-s',
                    CLI_SECURE_STORE_SERVICE,
                    '-w',
                ]);

                return toTrimmedValue(result.stdout);
            } catch (error) {
                if (isMissingSecretError(error)) {
                    return null;
                }

                failWith({
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to read the stored API key from macOS Keychain.',
                });

                throw new Error('Unreachable');
            }
        },
        writeApiKey: async (apiKey: string): Promise<void> => {
            try {
                await runCommand('security', [
                    'add-generic-password',
                    '-a',
                    CLI_SECURE_STORE_ACCOUNT,
                    '-s',
                    CLI_SECURE_STORE_SERVICE,
                    '-w',
                    apiKey,
                    '-U',
                ]);
            } catch {
                failWith({
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to store the API key in macOS Keychain.',
                });

                throw new Error('Unreachable');
            }
        },
    };
};

const unsupportedSecureStore: CliSecureStore = {
    clearApiKey: (): Promise<boolean> => {
        failWith({
            code: 'PRECONDITION_FAILED',
            message: getDefaultStoreStatus().reason ?? 'Secure auth storage is unavailable.',
        });

        throw new Error('Unreachable');
    },
    getStatus: (): Promise<CliSecureStoreStatus> => Promise.resolve(getDefaultStoreStatus()),
    readApiKey: (): Promise<string | null> => Promise.resolve(null),
    writeApiKey: (): Promise<void> => {
        failWith({
            code: 'PRECONDITION_FAILED',
            message: getDefaultStoreStatus().reason ?? 'Secure auth storage is unavailable.',
        });

        throw new Error('Unreachable');
    },
};

export const createSecureStore = (
    runCommand: SecureStoreCommandRunner = runSecureStoreCommand
): CliSecureStore => {
    if (process.platform === 'darwin') {
        return createMacOsSecureStore(runCommand);
    }

    return unsupportedSecureStore;
};

export const secureStore = createSecureStore();
