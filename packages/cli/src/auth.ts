import { spawnSync } from 'node:child_process';
import readline from 'node:readline';
import { failWith } from './errors.js';
import type { CliSecureStore } from './secure-store.js';
import { secureStore } from './secure-store.js';
import type { CliAuthStatus, CliCommand, CliFlags, ResolvedCliAuth } from './types.js';

const toOptionalTrimmed = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

export interface AuthInputReader {
    isInteractive(): boolean;
    readPrompt(prompt: string): Promise<string | null>;
    readStdin(): Promise<string | null>;
}

const resolveAuthSetInput = async (params: {
    command: CliCommand;
    flags: CliFlags;
    reader: AuthInputReader;
}): Promise<{
    apiKey: string | null;
    source: 'arg' | 'env' | 'flag' | 'prompt' | 'stdin' | null;
}> => {
    const fromArg = params.command.args.join(' ').trim();

    if (fromArg) {
        return {
            apiKey: fromArg,
            source: 'arg',
        };
    }

    if (params.flags.stdin) {
        const fromStdin = toOptionalTrimmed((await params.reader.readStdin()) ?? undefined);

        if (fromStdin) {
            return {
                apiKey: fromStdin,
                source: 'stdin',
            };
        }

        failWith({
            code: 'BAD_REQUEST',
            message: 'auth set --stdin received an empty API key.',
        });

        throw new Error('Unreachable');
    }

    const fromFlag = toOptionalTrimmed(params.flags.apiKey);

    if (fromFlag) {
        return {
            apiKey: fromFlag,
            source: 'flag',
        };
    }

    const fromEnv = toOptionalTrimmed(process.env.ES_API_KEY);

    if (fromEnv) {
        return {
            apiKey: fromEnv,
            source: 'env',
        };
    }

    if (params.reader.isInteractive()) {
        const fromPrompt = toOptionalTrimmed(
            (await params.reader.readPrompt('EtsySentry API key: ')) ?? undefined
        );

        if (fromPrompt) {
            return {
                apiKey: fromPrompt,
                source: 'prompt',
            };
        }

        failWith({
            code: 'BAD_REQUEST',
            message: 'auth set received an empty API key.',
        });

        throw new Error('Unreachable');
    }

    return {
        apiKey: null,
        source: null,
    };
};

export const resolveApiKey = async (
    params: {
        flags: CliFlags;
    },
    store: CliSecureStore = secureStore
): Promise<ResolvedCliAuth | null> => {
    const fromFlag = toOptionalTrimmed(params.flags.apiKey);

    if (fromFlag) {
        return {
            apiKey: fromFlag,
            source: 'flag',
            store: await store.getStatus(),
        };
    }

    const fromEnv = toOptionalTrimmed(process.env.ES_API_KEY);

    if (fromEnv) {
        return {
            apiKey: fromEnv,
            source: 'env',
            store: await store.getStatus(),
        };
    }

    const storedApiKey = await store.readApiKey();

    if (!storedApiKey) {
        return null;
    }

    return {
        apiKey: storedApiKey,
        source: 'secure-store',
        store: await store.getStatus(),
    };
};

export const resolveAuthStatus = async (
    params: {
        flags: CliFlags;
    },
    store: CliSecureStore = secureStore
): Promise<CliAuthStatus> => {
    const storeStatus = await store.getStatus();
    const hasEnvOverride = Boolean(toOptionalTrimmed(process.env.ES_API_KEY));
    const storedApiKey = await store.readApiKey();
    let activeSource: CliAuthStatus['activeSource'] = null;

    if (toOptionalTrimmed(params.flags.apiKey)) {
        activeSource = 'flag';
    } else if (hasEnvOverride) {
        activeSource = 'env';
    } else if (storedApiKey) {
        activeSource = 'secure-store';
    }

    return {
        activeSource,
        authenticated: activeSource !== null,
        hasEnvOverride,
        hasStoredApiKey: storedApiKey !== null,
        store: storeStatus,
    };
};

export const storeApiKeyFromCommand = async (
    params: {
        command: CliCommand;
        flags: CliFlags;
    },
    store: CliSecureStore = secureStore,
    reader: AuthInputReader = defaultAuthInputReader
): Promise<{
    source: 'arg' | 'env' | 'flag' | 'prompt' | 'stdin';
}> => {
    const input = await resolveAuthSetInput({ ...params, reader });

    if (!(input.apiKey && input.source)) {
        failWith({
            code: 'BAD_REQUEST',
            message: 'auth set requires <api-key>, --stdin, --api-key, or ES_API_KEY.',
        });

        throw new Error('Unreachable');
    }

    await store.writeApiKey(input.apiKey);

    return {
        source: input.source,
    };
};

const defaultAuthInputReader: AuthInputReader = {
    isInteractive: () => Boolean(process.stdin.isTTY && process.stderr.isTTY),
    readPrompt: (prompt: string) => readSecretFromPrompt(prompt),
    readStdin: () => readSecretFromStdin(),
};

const readSecretFromStdin = async (): Promise<string | null> => {
    const chunks: Buffer[] = [];

    for await (const chunk of process.stdin) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('utf8').trim();
};

const readSecretFromPrompt = async (prompt: string): Promise<string | null> => {
    process.stderr.write(prompt);
    setTerminalEcho(false);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stderr,
        terminal: true,
    });

    try {
        const value = await new Promise<string>((resolve) => {
            rl.question('', resolve);
        });
        process.stderr.write('\n');
        return value.trim();
    } finally {
        rl.close();
        setTerminalEcho(true);
    }
};

const setTerminalEcho = (enabled: boolean): void => {
    if (process.platform === 'win32' || !process.stdin.isTTY) {
        return;
    }

    spawnSync('stty', [enabled ? 'echo' : '-echo'], {
        stdio: ['inherit', 'ignore', 'ignore'],
    });
};
