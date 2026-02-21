import { describe, expect, test } from 'bun:test';
import { TRPCError } from '@trpc/server';
import {
    createEtsyOAuthService,
    type EtsyOAuthServiceDependencies,
    type EtsyOAuthStatus
} from './oauth-service';
import { EtsyOAuthStateStore } from './oauth-state-store';
import { EtsyOAuthTokenStore } from './token-store';

const createDependencies = (overrides: Partial<EtsyOAuthServiceDependencies> = {}) => {
    let nowMs = 1_000_000;

    const base: EtsyOAuthServiceDependencies = {
        exchangeToken: async () => {
            throw new Error('exchangeToken was not stubbed for this test');
        },
        nowMs: () => nowMs,
        pkceFactory: () => ({
            codeChallenge: 'challenge-1',
            codeVerifier: 'verifier-1'
        }),
        sessionIdFactory: () => 'session-1',
        stateStore: new EtsyOAuthStateStore(60_000),
        tokenStore: new EtsyOAuthTokenStore()
    };

    return {
        dependencies: {
            ...base,
            ...overrides
        },
        setNowMs: (nextNowMs: number) => {
            nowMs = nextNowMs;
        }
    };
};

const expectConnected = (status: EtsyOAuthStatus) => {
    expect(status.connected).toBe(true);
    expect(status.expiresAt).not.toBeNull();
};

describe('oauth-service', () => {
    test('startOAuthFlow returns an authorization URL and scoped session id', () => {
        const { dependencies } = createDependencies();
        const service = createEtsyOAuthService(dependencies);

        const flow = service.startOAuthFlow();
        const url = new URL(flow.authorizationUrl);
        const state = url.searchParams.get('state');

        expect(flow.oauthSessionId).toBe('session-1');
        expect(url.origin + url.pathname).toBe('https://www.etsy.com/oauth/connect');
        expect(url.searchParams.get('code_challenge')).toBe('challenge-1');
        expect(typeof state).toBe('string');

        const statePayload = dependencies.stateStore.consume(state ?? '');
        expect(statePayload).toEqual({
            codeVerifier: 'verifier-1',
            oauthSessionId: 'session-1'
        });
    });

    test('completeOAuthFlow stores tokens only for the state session', async () => {
        let exchangeInput: unknown;
        const { dependencies, setNowMs } = createDependencies({
            exchangeToken: async (input) => {
                exchangeInput = input;
                return {
                    accessToken: 'access-1',
                    expiresInSeconds: 3600,
                    refreshToken: 'refresh-1',
                    scopes: ['listings_r'],
                    tokenType: 'Bearer'
                };
            }
        });
        const service = createEtsyOAuthService(dependencies);

        setNowMs(2_000_000);
        const issued = dependencies.stateStore.issue({
            codeVerifier: 'verifier-1',
            oauthSessionId: 'session-1'
        });

        const status = await service.completeOAuthFlow({
            code: 'code-1',
            state: issued.state
        });

        expect(exchangeInput).toEqual({
            code: 'code-1',
            codeVerifier: 'verifier-1',
            grantType: 'authorization_code',
            redirectUri: process.env.ETSY_OAUTH_REDIRECT_URI
        });
        expectConnected(status);
        expect(status.scopes).toEqual(['listings_r']);

        const ownStatus = await service.getOAuthStatus({ oauthSessionId: 'session-1' });
        expect(ownStatus.connected).toBe(true);

        const otherStatus = await service.getOAuthStatus({ oauthSessionId: 'session-2' });
        expect(otherStatus).toEqual({
            connected: false,
            expiresAt: null,
            needsRefresh: false,
            scopes: []
        });
    });

    test('completeOAuthFlow rejects unknown state', async () => {
        const { dependencies } = createDependencies();
        const service = createEtsyOAuthService(dependencies);

        await expect(
            service.completeOAuthFlow({
                code: 'code-1',
                state: 'missing-state'
            })
        ).rejects.toMatchObject({
            code: 'BAD_REQUEST'
        });
    });

    test('refreshOAuthAccessToken requires scoped connection and refreshes tokens', async () => {
        const { dependencies, setNowMs } = createDependencies({
            exchangeToken: async (input) => {
                if (input.grantType !== 'refresh_token') {
                    throw new Error('expected refresh_token grant');
                }

                return {
                    accessToken: 'access-2',
                    expiresInSeconds: 1800,
                    refreshToken: 'refresh-2',
                    scopes: ['listings_r', 'shops_r'],
                    tokenType: 'Bearer'
                };
            }
        });
        const service = createEtsyOAuthService(dependencies);

        await expect(
            service.refreshOAuthAccessToken({
                oauthSessionId: 'missing-session'
            })
        ).rejects.toBeInstanceOf(TRPCError);

        dependencies.tokenStore.set('session-1', {
            accessToken: 'access-1',
            expiresAt: new Date(2_000_000),
            refreshToken: 'refresh-1',
            scopes: ['listings_r'],
            tokenType: 'Bearer'
        });

        setNowMs(3_000_000);
        const status = await service.refreshOAuthAccessToken({
            oauthSessionId: 'session-1'
        });

        expectConnected(status);
        expect(status.scopes).toEqual(['listings_r', 'shops_r']);
    });

    test('getOAuthStatus auto-refreshes when token is stale', async () => {
        let refreshCalls = 0;
        const { dependencies, setNowMs } = createDependencies({
            exchangeToken: async (input) => {
                if (input.grantType !== 'refresh_token') {
                    throw new Error('expected refresh_token grant');
                }

                refreshCalls += 1;

                return {
                    accessToken: 'access-2',
                    expiresInSeconds: 3600,
                    refreshToken: 'refresh-2',
                    scopes: ['listings_r'],
                    tokenType: 'Bearer'
                };
            }
        });
        const service = createEtsyOAuthService(dependencies);

        setNowMs(1_000_000);
        dependencies.tokenStore.set('session-1', {
            accessToken: 'access-1',
            expiresAt: new Date(1_050_000),
            refreshToken: 'refresh-1',
            scopes: ['listings_r'],
            tokenType: 'Bearer'
        });

        const status = await service.getOAuthStatus({
            oauthSessionId: 'session-1'
        });

        expect(refreshCalls).toBe(1);
        expect(status).toMatchObject({
            connected: true,
            needsRefresh: false,
            scopes: ['listings_r']
        });
    });

    test('getOAuthAccessToken auto-refreshes only when stale', async () => {
        let refreshCalls = 0;
        const { dependencies, setNowMs } = createDependencies({
            exchangeToken: async (input) => {
                if (input.grantType !== 'refresh_token') {
                    throw new Error('expected refresh_token grant');
                }

                refreshCalls += 1;

                return {
                    accessToken: 'access-2',
                    expiresInSeconds: 1800,
                    refreshToken: 'refresh-2',
                    scopes: ['listings_r', 'shops_r'],
                    tokenType: 'Bearer'
                };
            }
        });
        const service = createEtsyOAuthService(dependencies);

        setNowMs(1_000_000);
        dependencies.tokenStore.set('session-fresh', {
            accessToken: 'access-fresh',
            expiresAt: new Date(1_500_000),
            refreshToken: 'refresh-fresh',
            scopes: ['listings_r'],
            tokenType: 'Bearer'
        });

        const freshAccessToken = await service.getOAuthAccessToken({
            oauthSessionId: 'session-fresh'
        });
        expect(freshAccessToken.accessToken).toBe('access-fresh');
        expect(refreshCalls).toBe(0);

        dependencies.tokenStore.set('session-stale', {
            accessToken: 'access-1',
            expiresAt: new Date(1_050_000),
            refreshToken: 'refresh-1',
            scopes: ['listings_r'],
            tokenType: 'Bearer'
        });

        const staleAccessToken = await service.getOAuthAccessToken({
            oauthSessionId: 'session-stale'
        });
        expect(staleAccessToken.accessToken).toBe('access-2');
        expect(staleAccessToken.scopes).toEqual(['listings_r', 'shops_r']);
        expect(refreshCalls).toBe(1);
    });
});
