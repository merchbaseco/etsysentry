import { TRPCError } from '@trpc/server';
import { env } from '../../config/env';
import {
    exchangeOAuthToken,
    EtsyOAuthBridgeError,
    type EtsyOAuthTokenRequest,
    type EtsyOAuthTokenResponse
} from './bridges/exchange-oauth-token';
import { createPkcePair } from './oauth-pkce';
import { etsyOAuthConnectionStore, etsyOAuthStateStore } from './oauth-runtime';
import { recordEtsyApiCallBestEffort } from './record-etsy-api-call';
import type {
    EtsyOAuthConnectionKey,
    EtsyOAuthConnectionStore,
    EtsyOAuthTokens
} from './connection-store';
import type { EtsyOAuthStateStore } from './oauth-state-store';

const REQUIRED_ETSY_OAUTH_SCOPES = ['listings_r'] as const;

const formatConnectionKeyForLog = (key: EtsyOAuthConnectionKey): string => {
    return key.accountId.slice(0, 8);
};

const logOAuthDebug = (message: string, details: Record<string, unknown>): void => {
    console.info(`[EtsyOAuth] ${message}`, details);
};

export type EtsyOAuthStatus = {
    connected: boolean;
    expiresAt: Date | null;
    needsRefresh: boolean;
    scopes: string[];
};

export type EtsyOAuthAccessToken = {
    accessToken: string;
    expiresAt: Date;
    scopes: string[];
    tokenType: string;
};

export type EtsyOAuthIdentity = EtsyOAuthConnectionKey;

export type EtsyOAuthServiceDependencies = {
    connectionStore: EtsyOAuthConnectionStore;
    exchangeToken: (input: EtsyOAuthTokenRequest) => Promise<EtsyOAuthTokenResponse>;
    nowMs: () => number;
    pkceFactory: () => {
        codeChallenge: string;
        codeVerifier: string;
    };
    recordApiCall: (params: {
        endpoint: string;
        accountId: string;
    }) => Promise<void>;
    stateStore: EtsyOAuthStateStore;
};

const defaultDependencies: EtsyOAuthServiceDependencies = {
    connectionStore: etsyOAuthConnectionStore,
    exchangeToken: exchangeOAuthToken,
    nowMs: () => Date.now(),
    pkceFactory: createPkcePair,
    recordApiCall: ({ accountId, endpoint }) => {
        return recordEtsyApiCallBestEffort({
            accountId,
            clerkUserId: 'system',
            endpoint
        });
    },
    stateStore: etsyOAuthStateStore
};

const getAuthorizationUrl = (params: {
    codeChallenge: string;
    state: string;
}): string => {
    const url = new URL('https://www.etsy.com/oauth/connect');

    url.search = new URLSearchParams({
        client_id: env.ETSY_API_KEY,
        code_challenge: params.codeChallenge,
        code_challenge_method: 'S256',
        redirect_uri: env.ETSY_OAUTH_REDIRECT_URI,
        response_type: 'code',
        scope: env.etsyOAuthScopes.join(' '),
        state: params.state
    }).toString();

    return url.toString();
};

const toInternalError = (error: unknown): never => {
    if (error instanceof EtsyOAuthBridgeError) {
        throw new TRPCError({
            cause: error,
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
        });
    }

    throw error;
};

const createStatus = (params: {
    nowMs: number;
    tokens: {
        expiresAt: Date;
        scopes: string[];
    } | null;
}): EtsyOAuthStatus => {
    if (!params.tokens) {
        return {
            connected: false,
            expiresAt: null,
            needsRefresh: false,
            scopes: []
        };
    }

    return {
        connected: true,
        expiresAt: params.tokens.expiresAt,
        needsRefresh:
            params.nowMs + env.ETSY_OAUTH_REFRESH_SKEW_MS >= params.tokens.expiresAt.getTime(),
        scopes: [...params.tokens.scopes]
    };
};

export const createEtsyOAuthService = (
    overrides: Partial<EtsyOAuthServiceDependencies> = {}
): {
    completeOAuthFlow: (params: { code: string; state: string }) => Promise<EtsyOAuthStatus>;
    disconnectOAuthSession: (params: EtsyOAuthIdentity) => Promise<EtsyOAuthStatus>;
    getOAuthAccessToken: (params: EtsyOAuthIdentity) => Promise<EtsyOAuthAccessToken>;
    getOAuthStatus: (params: EtsyOAuthIdentity) => Promise<EtsyOAuthStatus>;
    refreshOAuthAccessToken: (params: EtsyOAuthIdentity) => Promise<EtsyOAuthStatus>;
    startOAuthFlow: (params: EtsyOAuthIdentity) => {
        authorizationUrl: string;
        expiresAt: Date;
    };
} => {
    const dependencies: EtsyOAuthServiceDependencies = {
        ...defaultDependencies,
        ...overrides
    };

    const persistTokens = async (
        identity: EtsyOAuthIdentity,
        tokenResponse: EtsyOAuthTokenResponse
    ): Promise<EtsyOAuthTokens> => {
        const nextTokens: EtsyOAuthTokens = {
            accessToken: tokenResponse.accessToken,
            expiresAt: new Date(dependencies.nowMs() + tokenResponse.expiresInSeconds * 1000),
            refreshToken: tokenResponse.refreshToken,
            scopes: tokenResponse.scopes,
            tokenType: tokenResponse.tokenType
        };

        await dependencies.connectionStore.set(identity, nextTokens);

        logOAuthDebug('persisted OAuth tokens', {
            connectionKey: formatConnectionKeyForLog(identity),
            expiresAt: nextTokens.expiresAt.toISOString(),
            scopeCount: nextTokens.scopes.length,
            scopes: nextTokens.scopes
        });

        return nextTokens;
    };

    const refreshTokens = async (params: {
        identity: EtsyOAuthIdentity;
        refreshToken: string;
    }): Promise<EtsyOAuthTokens> => {
        try {
            await dependencies.recordApiCall({
                endpoint: 'exchangeOAuthToken',
                accountId: params.identity.accountId
            });

            const refreshed = await dependencies.exchangeToken({
                grantType: 'refresh_token',
                refreshToken: params.refreshToken
            });

            logOAuthDebug('received refresh token exchange response', {
                connectionKey: formatConnectionKeyForLog(params.identity),
                scopeCount: refreshed.scopes.length,
                scopes: refreshed.scopes
            });

            return persistTokens(params.identity, refreshed);
        } catch (error) {
            return toInternalError(error);
        }
    };

    const ensureConnectedTokens = async (params: {
        identity: EtsyOAuthIdentity;
    }): Promise<EtsyOAuthTokens> => {
        const tokens = await dependencies.connectionStore.get(params.identity);

        if (!tokens) {
            throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: 'Etsy OAuth is not connected. Run the start flow first.'
            });
        }

        return tokens;
    };

    const ensureFreshTokens = async (params: {
        identity: EtsyOAuthIdentity;
    }): Promise<EtsyOAuthTokens> => {
        const tokens = await ensureConnectedTokens(params);
        const status = createStatus({
            nowMs: dependencies.nowMs(),
            tokens
        });

        if (!status.needsRefresh) {
            logOAuthDebug('using existing OAuth tokens without refresh', {
                connectionKey: formatConnectionKeyForLog(params.identity),
                expiresAt: tokens.expiresAt.toISOString(),
                scopes: tokens.scopes
            });

            return tokens;
        }

        logOAuthDebug('refreshing stale OAuth tokens', {
            connectionKey: formatConnectionKeyForLog(params.identity),
            expiresAt: tokens.expiresAt.toISOString(),
            scopes: tokens.scopes
        });

        return refreshTokens({
            identity: params.identity,
            refreshToken: tokens.refreshToken
        });
    };

    const getOAuthAccessToken = async (
        params: EtsyOAuthIdentity
    ): Promise<EtsyOAuthAccessToken> => {
        const tokens = await ensureFreshTokens({
            identity: params
        });
        const hasExplicitScopes = tokens.scopes.length > 0;
        const missingScopes = REQUIRED_ETSY_OAUTH_SCOPES.filter(
            (scope) => !tokens.scopes.includes(scope)
        );

        if (hasExplicitScopes && missingScopes.length > 0) {
            const missingScopesSummary = missingScopes.join(', ');
            const reconnectMessage =
                `Etsy OAuth session is missing required scope(s): ${missingScopesSummary}. ` +
                'Reconnect Etsy OAuth.';

            logOAuthDebug('required scope check failed', {
                connectionKey: formatConnectionKeyForLog(params),
                missingScopes,
                scopes: tokens.scopes
            });

            throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: reconnectMessage
            });
        }

        if (!hasExplicitScopes) {
            logOAuthDebug('required scope check skipped because token response omitted scopes', {
                connectionKey: formatConnectionKeyForLog(params)
            });
        }

        return {
            accessToken: tokens.accessToken,
            expiresAt: tokens.expiresAt,
            scopes: [...tokens.scopes],
            tokenType: tokens.tokenType
        };
    };

    const getOAuthStatus = async (params: EtsyOAuthIdentity): Promise<EtsyOAuthStatus> => {
        const currentTokens = await dependencies.connectionStore.get(params);

        if (!currentTokens) {
            return createStatus({
                nowMs: dependencies.nowMs(),
                tokens: null
            });
        }

        const tokens = await ensureFreshTokens({
            identity: params
        });

        return createStatus({
            nowMs: dependencies.nowMs(),
            tokens
        });
    };

    const startOAuthFlow = (params: EtsyOAuthIdentity): {
        authorizationUrl: string;
        expiresAt: Date;
    } => {
        const pkce = dependencies.pkceFactory();
        const stateEntry = dependencies.stateStore.issue({
            codeVerifier: pkce.codeVerifier,
            accountId: params.accountId
        });

        logOAuthDebug('issued OAuth start flow', {
            connectionKey: formatConnectionKeyForLog(params),
            expiresAt: stateEntry.expiresAt.toISOString(),
            scopes: env.etsyOAuthScopes
        });

        return {
            authorizationUrl: getAuthorizationUrl({
                codeChallenge: pkce.codeChallenge,
                state: stateEntry.state
            }),
            expiresAt: stateEntry.expiresAt
        };
    };

    const completeOAuthFlow = async (params: {
        code: string;
        state: string;
    }): Promise<EtsyOAuthStatus> => {
        const statePayload = dependencies.stateStore.consume(params.state);

        if (!statePayload) {
            logOAuthDebug('OAuth callback state was invalid or expired', {
                statePrefix: params.state.slice(0, 12)
            });

            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'OAuth state was invalid or expired. Start OAuth again from the dashboard.'
            });
        }

        const identity: EtsyOAuthIdentity = {
            accountId: statePayload.accountId
        };

        try {
            await dependencies.recordApiCall({
                endpoint: 'exchangeOAuthToken',
                accountId: identity.accountId
            });

            const tokenResponse = await dependencies.exchangeToken({
                code: params.code,
                codeVerifier: statePayload.codeVerifier,
                grantType: 'authorization_code',
                redirectUri: env.ETSY_OAUTH_REDIRECT_URI
            });

            logOAuthDebug('received auth code token exchange response', {
                connectionKey: formatConnectionKeyForLog(identity),
                scopeCount: tokenResponse.scopes.length,
                scopes: tokenResponse.scopes
            });

            await persistTokens(identity, tokenResponse);

            return getOAuthStatus(identity);
        } catch (error) {
            return toInternalError(error);
        }
    };

    const refreshOAuthAccessToken = async (params: EtsyOAuthIdentity): Promise<EtsyOAuthStatus> => {
        const tokens = await ensureConnectedTokens({
            identity: params
        });

        logOAuthDebug('manual refresh requested', {
            connectionKey: formatConnectionKeyForLog(params),
            expiresAt: tokens.expiresAt.toISOString(),
            scopes: tokens.scopes
        });

        await refreshTokens({
            identity: params,
            refreshToken: tokens.refreshToken
        });

        return getOAuthStatus(params);
    };

    const disconnectOAuthSession = async (params: EtsyOAuthIdentity): Promise<EtsyOAuthStatus> => {
        await dependencies.connectionStore.clear(params);

        logOAuthDebug('cleared OAuth session tokens', {
            connectionKey: formatConnectionKeyForLog(params)
        });

        return createStatus({
            nowMs: dependencies.nowMs(),
            tokens: null
        });
    };

    return {
        completeOAuthFlow,
        disconnectOAuthSession,
        getOAuthAccessToken,
        getOAuthStatus,
        refreshOAuthAccessToken,
        startOAuthFlow
    };
};

const etsyOAuthService = createEtsyOAuthService();

export const completeEtsyOAuthFlow = etsyOAuthService.completeOAuthFlow;
export const disconnectEtsyOAuthSession = etsyOAuthService.disconnectOAuthSession;
export const getEtsyOAuthAccessToken = etsyOAuthService.getOAuthAccessToken;
export const getEtsyOAuthStatus = etsyOAuthService.getOAuthStatus;
export const refreshEtsyOAuthAccessToken = etsyOAuthService.refreshOAuthAccessToken;
export const startEtsyOAuthFlow = etsyOAuthService.startOAuthFlow;
