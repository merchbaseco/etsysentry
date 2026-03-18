import { failWith } from './errors.js';
import type { CliSecureStore } from './secure-store.js';
import { secureStore } from './secure-store.js';
import type { CliAuthStatus, CliCommand, CliFlags, ResolvedCliAuth } from './types.js';

const toOptionalTrimmed = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const resolveAuthSetInput = (params: {
    command: CliCommand;
    flags: CliFlags;
}): {
    apiKey: string | null;
    source: 'arg' | 'env' | 'flag' | null;
} => {
    const fromArg = params.command.args.join(' ').trim();

    if (fromArg) {
        return {
            apiKey: fromArg,
            source: 'arg',
        };
    }

    const fromFlag = toOptionalTrimmed(params.flags.apiKey);

    if (fromFlag) {
        return {
            apiKey: fromFlag,
            source: 'flag',
        };
    }

    const fromEnv = toOptionalTrimmed(process.env.ES_API_KEY);

    return {
        apiKey: fromEnv ?? null,
        source: fromEnv ? 'env' : null,
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
    store: CliSecureStore = secureStore
): Promise<{
    source: 'arg' | 'env' | 'flag';
}> => {
    const input = resolveAuthSetInput(params);

    if (!(input.apiKey && input.source)) {
        failWith({
            code: 'BAD_REQUEST',
            message: 'auth set requires <api-key>, --api-key, or ES_API_KEY.',
        });

        throw new Error('Unreachable');
    }

    await store.writeApiKey(input.apiKey);

    return {
        source: input.source,
    };
};
