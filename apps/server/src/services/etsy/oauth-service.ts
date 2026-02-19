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
import type { EtsyOAuthTokenStore } from './token-store';

export type EtsyOAuthStatus = {
    connected: boolean;
    expiresAt: Date | null;
    needsRefresh: boolean;
    scopes: string[];
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
    getOAuthStatus: (params: { oauthSessionId: EtsyOAuthSessionId }) => EtsyOAuthStatus;
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

    const getOAuthStatus = (params: {
        oauthSessionId: EtsyOAuthSessionId;
    }): EtsyOAuthStatus => {
        const tokens = dependencies.tokenStore.get(params.oauthSessionId);

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

            dependencies.tokenStore.set(statePayload.oauthSessionId, {
                accessToken: tokenResponse.accessToken,
                expiresAt: new Date(dependencies.nowMs() + tokenResponse.expiresInSeconds * 1000),
                refreshToken: tokenResponse.refreshToken,
                scopes: tokenResponse.scopes,
                tokenType: tokenResponse.tokenType
            });

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
        const tokens = dependencies.tokenStore.get(params.oauthSessionId);

        if (!tokens) {
            throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: 'Etsy OAuth is not connected. Run the start flow first.'
            });
        }

        try {
            const refreshed = await dependencies.exchangeToken({
                grantType: 'refresh_token',
                refreshToken: tokens.refreshToken
            });

            dependencies.tokenStore.set(params.oauthSessionId, {
                accessToken: refreshed.accessToken,
                expiresAt: new Date(dependencies.nowMs() + refreshed.expiresInSeconds * 1000),
                refreshToken: refreshed.refreshToken,
                scopes: refreshed.scopes,
                tokenType: refreshed.tokenType
            });

            return getOAuthStatus({
                oauthSessionId: params.oauthSessionId
            });
        } catch (error) {
            return toInternalError(error);
        }
    };

    return {
        completeOAuthFlow,
        getOAuthStatus,
        refreshOAuthAccessToken,
        startOAuthFlow
    };
};

const etsyOAuthService = createEtsyOAuthService();

export const completeEtsyOAuthFlow = etsyOAuthService.completeOAuthFlow;
export const getEtsyOAuthStatus = etsyOAuthService.getOAuthStatus;
export const refreshEtsyOAuthAccessToken = etsyOAuthService.refreshOAuthAccessToken;
export const startEtsyOAuthFlow = etsyOAuthService.startOAuthFlow;
