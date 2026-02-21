import { randomBytes } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { env } from '../../config/env';
import {
    exchangeOAuthToken,
    EtsyOAuthBridgeError,
    type EtsyOAuthTokenRequest,
    type EtsyOAuthTokenResponse
} from './bridges/exchange-oauth-token';
import { createPkcePair } from './oauth-pkce';
import { etsyOAuthStateStore, etsyOAuthTokenStore } from './oauth-runtime';
import type { EtsyOAuthStateStore } from './oauth-state-store';
import type { EtsyOAuthTokenStore, EtsyOAuthTokens } from './token-store';

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

export type EtsyOAuthSessionId = string;

export type EtsyOAuthServiceDependencies = {
    exchangeToken: (input: EtsyOAuthTokenRequest) => Promise<EtsyOAuthTokenResponse>;
    nowMs: () => number;
    pkceFactory: () => {
        codeChallenge: string;
        codeVerifier: string;
    };
    sessionIdFactory: () => EtsyOAuthSessionId;
    stateStore: EtsyOAuthStateStore;
    tokenStore: EtsyOAuthTokenStore;
};

const defaultDependencies: EtsyOAuthServiceDependencies = {
    exchangeToken: exchangeOAuthToken,
    nowMs: () => Date.now(),
    pkceFactory: createPkcePair,
    sessionIdFactory: () => randomBytes(32).toString('base64url'),
    stateStore: etsyOAuthStateStore,
    tokenStore: etsyOAuthTokenStore
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
    getOAuthAccessToken: (params: {
        oauthSessionId: EtsyOAuthSessionId;
    }) => Promise<EtsyOAuthAccessToken>;
    getOAuthStatus: (params: { oauthSessionId: EtsyOAuthSessionId }) => Promise<EtsyOAuthStatus>;
    refreshOAuthAccessToken: (params: {
        oauthSessionId: EtsyOAuthSessionId;
    }) => Promise<EtsyOAuthStatus>;
    startOAuthFlow: () => {
        authorizationUrl: string;
        expiresAt: Date;
        oauthSessionId: EtsyOAuthSessionId;
    };
} => {
    const dependencies: EtsyOAuthServiceDependencies = {
        ...defaultDependencies,
        ...overrides
    };

    const persistTokens = (
        oauthSessionId: EtsyOAuthSessionId,
        tokenResponse: EtsyOAuthTokenResponse
    ): EtsyOAuthTokens => {
        const nextTokens: EtsyOAuthTokens = {
            accessToken: tokenResponse.accessToken,
            expiresAt: new Date(dependencies.nowMs() + tokenResponse.expiresInSeconds * 1000),
            refreshToken: tokenResponse.refreshToken,
            scopes: tokenResponse.scopes,
            tokenType: tokenResponse.tokenType
        };

        dependencies.tokenStore.set(oauthSessionId, nextTokens);

        return nextTokens;
    };

    const refreshTokens = async (params: {
        oauthSessionId: EtsyOAuthSessionId;
        refreshToken: string;
    }): Promise<EtsyOAuthTokens> => {
        try {
            const refreshed = await dependencies.exchangeToken({
                grantType: 'refresh_token',
                refreshToken: params.refreshToken
            });

            return persistTokens(params.oauthSessionId, refreshed);
        } catch (error) {
            return toInternalError(error);
        }
    };

    const ensureConnectedTokens = (params: {
        oauthSessionId: EtsyOAuthSessionId;
    }): EtsyOAuthTokens => {
        const tokens = dependencies.tokenStore.get(params.oauthSessionId);

        if (!tokens) {
            throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: 'Etsy OAuth is not connected. Run the start flow first.'
            });
        }

        return tokens;
    };

    const ensureFreshTokens = async (params: {
        oauthSessionId: EtsyOAuthSessionId;
    }): Promise<EtsyOAuthTokens> => {
        const tokens = ensureConnectedTokens(params);
        const status = createStatus({
            nowMs: dependencies.nowMs(),
            tokens
        });

        if (!status.needsRefresh) {
            return tokens;
        }

        return refreshTokens({
            oauthSessionId: params.oauthSessionId,
            refreshToken: tokens.refreshToken
        });
    };

    const getOAuthAccessToken = async (params: {
        oauthSessionId: EtsyOAuthSessionId;
    }): Promise<EtsyOAuthAccessToken> => {
        const tokens = await ensureFreshTokens(params);

        return {
            accessToken: tokens.accessToken,
            expiresAt: tokens.expiresAt,
            scopes: [...tokens.scopes],
            tokenType: tokens.tokenType
        };
    };

    const getOAuthStatus = async (params: {
        oauthSessionId: EtsyOAuthSessionId;
    }): Promise<EtsyOAuthStatus> => {
        const currentTokens = dependencies.tokenStore.get(params.oauthSessionId);

        if (!currentTokens) {
            return createStatus({
                nowMs: dependencies.nowMs(),
                tokens: null
            });
        }

        const tokens = await ensureFreshTokens(params);

        return createStatus({
            nowMs: dependencies.nowMs(),
            tokens
        });
    };

    const startOAuthFlow = (): {
        authorizationUrl: string;
        expiresAt: Date;
        oauthSessionId: EtsyOAuthSessionId;
    } => {
        const oauthSessionId = dependencies.sessionIdFactory();
        const pkce = dependencies.pkceFactory();
        const stateEntry = dependencies.stateStore.issue({
            codeVerifier: pkce.codeVerifier,
            oauthSessionId
        });

        return {
            authorizationUrl: getAuthorizationUrl({
                codeChallenge: pkce.codeChallenge,
                state: stateEntry.state
            }),
            expiresAt: stateEntry.expiresAt,
            oauthSessionId
        };
    };

    const completeOAuthFlow = async (params: {
        code: string;
        state: string;
    }): Promise<EtsyOAuthStatus> => {
        const statePayload = dependencies.stateStore.consume(params.state);

        if (!statePayload) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'OAuth state was invalid or expired. Start OAuth again from the dashboard.'
            });
        }

        try {
            const tokenResponse = await dependencies.exchangeToken({
                code: params.code,
                codeVerifier: statePayload.codeVerifier,
                grantType: 'authorization_code',
                redirectUri: env.ETSY_OAUTH_REDIRECT_URI
            });

            persistTokens(statePayload.oauthSessionId, tokenResponse);

            return getOAuthStatus({
                oauthSessionId: statePayload.oauthSessionId
            });
        } catch (error) {
            return toInternalError(error);
        }
    };

    const refreshOAuthAccessToken = async (params: {
        oauthSessionId: EtsyOAuthSessionId;
    }): Promise<EtsyOAuthStatus> => {
        const tokens = ensureConnectedTokens(params);

        await refreshTokens({
            oauthSessionId: params.oauthSessionId,
            refreshToken: tokens.refreshToken
        });

        return getOAuthStatus({
            oauthSessionId: params.oauthSessionId
        });
    };

    return {
        completeOAuthFlow,
        getOAuthAccessToken,
        getOAuthStatus,
        refreshOAuthAccessToken,
        startOAuthFlow
    };
};

const etsyOAuthService = createEtsyOAuthService();

export const completeEtsyOAuthFlow = etsyOAuthService.completeOAuthFlow;
export const getEtsyOAuthAccessToken = etsyOAuthService.getOAuthAccessToken;
export const getEtsyOAuthStatus = etsyOAuthService.getOAuthStatus;
export const refreshEtsyOAuthAccessToken = etsyOAuthService.refreshOAuthAccessToken;
export const startEtsyOAuthFlow = etsyOAuthService.startOAuthFlow;
