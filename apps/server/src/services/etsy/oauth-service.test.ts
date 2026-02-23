import { describe, expect, test } from 'bun:test';
import { TRPCError } from '@trpc/server';
import {
    InMemoryEtsyOAuthConnectionStore,
    type EtsyOAuthConnectionKey
} from './connection-store';
import {
    createEtsyOAuthService,
    type EtsyOAuthServiceDependencies,
    type EtsyOAuthStatus
} from './oauth-service';
import { EtsyOAuthStateStore } from './oauth-state-store';

const primaryIdentity: EtsyOAuthConnectionKey = {
    clerkUserId: 'user-1',
    tenantId: 'tenant-1'
};

const secondaryIdentity: EtsyOAuthConnectionKey = {
    clerkUserId: 'user-2',
    tenantId: 'tenant-1'
};

const createDependencies = (overrides: Partial<EtsyOAuthServiceDependencies> = {}) => {
    let nowMs = 1_000_000;

    const base: EtsyOAuthServiceDependencies = {
        connectionStore: new InMemoryEtsyOAuthConnectionStore(),
        exchangeToken: async () => {
            throw new Error('exchangeToken was not stubbed for this test');
        },
        nowMs: () => nowMs,
        pkceFactory: () => ({
            codeChallenge: 'challenge-1',
            codeVerifier: 'verifier-1'
        }),
        recordApiCall: async () => {},
        stateStore: new EtsyOAuthStateStore(60_000)
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
    test('startOAuthFlow returns an authorization URL and stores identity in state', () => {
        const { dependencies } = createDependencies();
        const service = createEtsyOAuthService(dependencies);

        const flow = service.startOAuthFlow(primaryIdentity);
        const url = new URL(flow.authorizationUrl);
        const state = url.searchParams.get('state');

        expect(url.origin + url.pathname).toBe('https://www.etsy.com/oauth/connect');
        expect(url.searchParams.get('code_challenge')).toBe('challenge-1');
        expect(typeof state).toBe('string');

        const statePayload = dependencies.stateStore.consume(state ?? '');
        expect(statePayload).toEqual({
            clerkUserId: primaryIdentity.clerkUserId,
            codeVerifier: 'verifier-1',
            tenantId: primaryIdentity.tenantId
        });
    });

    test('completeOAuthFlow stores tokens for the state identity', async () => {
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
            clerkUserId: primaryIdentity.clerkUserId,
            codeVerifier: 'verifier-1',
            tenantId: primaryIdentity.tenantId
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

        const ownStatus = await service.getOAuthStatus(primaryIdentity);
        expect(ownStatus.connected).toBe(true);

        const otherStatus = await service.getOAuthStatus(secondaryIdentity);
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

    test('refreshOAuthAccessToken requires connection and refreshes tokens', async () => {
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

        await expect(service.refreshOAuthAccessToken(primaryIdentity)).rejects.toBeInstanceOf(TRPCError);

        await dependencies.connectionStore.set(primaryIdentity, {
            accessToken: 'access-1',
            expiresAt: new Date(2_000_000),
            refreshToken: 'refresh-1',
            scopes: ['listings_r'],
            tokenType: 'Bearer'
        });

        setNowMs(3_000_000);
        const status = await service.refreshOAuthAccessToken(primaryIdentity);

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
        await dependencies.connectionStore.set(primaryIdentity, {
            accessToken: 'access-1',
            expiresAt: new Date(1_050_000),
            refreshToken: 'refresh-1',
            scopes: ['listings_r'],
            tokenType: 'Bearer'
        });

        const status = await service.getOAuthStatus(primaryIdentity);

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

        const freshIdentity: EtsyOAuthConnectionKey = {
            clerkUserId: 'user-fresh',
            tenantId: 'tenant-1'
        };

        const staleIdentity: EtsyOAuthConnectionKey = {
            clerkUserId: 'user-stale',
            tenantId: 'tenant-1'
        };

        setNowMs(1_000_000);
        await dependencies.connectionStore.set(freshIdentity, {
            accessToken: 'access-fresh',
            expiresAt: new Date(1_500_000),
            refreshToken: 'refresh-fresh',
            scopes: ['listings_r'],
            tokenType: 'Bearer'
        });

        const freshAccessToken = await service.getOAuthAccessToken(freshIdentity);
        expect(freshAccessToken.accessToken).toBe('access-fresh');
        expect(refreshCalls).toBe(0);

        await dependencies.connectionStore.set(staleIdentity, {
            accessToken: 'access-1',
            expiresAt: new Date(1_050_000),
            refreshToken: 'refresh-1',
            scopes: ['listings_r'],
            tokenType: 'Bearer'
        });

        const staleAccessToken = await service.getOAuthAccessToken(staleIdentity);
        expect(staleAccessToken.accessToken).toBe('access-2');
        expect(staleAccessToken.scopes).toEqual(['listings_r', 'shops_r']);
        expect(refreshCalls).toBe(1);
    });

    test('getOAuthAccessToken rejects tokens missing listings_r scope', async () => {
        const { dependencies } = createDependencies();
        const service = createEtsyOAuthService(dependencies);

        await dependencies.connectionStore.set(primaryIdentity, {
            accessToken: 'access-1',
            expiresAt: new Date(2_000_000),
            refreshToken: 'refresh-1',
            scopes: ['shops_r'],
            tokenType: 'Bearer'
        });

        await expect(service.getOAuthAccessToken(primaryIdentity)).rejects.toMatchObject({
            code: 'PRECONDITION_FAILED',
            message:
                'Etsy OAuth session is missing required scope(s): listings_r. Reconnect Etsy OAuth.'
        });
    });

    test('getOAuthAccessToken allows tokens when Etsy omits scope values', async () => {
        const { dependencies } = createDependencies();
        const service = createEtsyOAuthService(dependencies);

        await dependencies.connectionStore.set(primaryIdentity, {
            accessToken: 'access-1',
            expiresAt: new Date(2_000_000),
            refreshToken: 'refresh-1',
            scopes: [],
            tokenType: 'Bearer'
        });

        const accessToken = await service.getOAuthAccessToken(primaryIdentity);

        expect(accessToken).toMatchObject({
            accessToken: 'access-1',
            scopes: [],
            tokenType: 'Bearer'
        });
    });

    test('disconnectOAuthSession clears stored tokens', async () => {
        const { dependencies } = createDependencies();
        const service = createEtsyOAuthService(dependencies);

        await dependencies.connectionStore.set(primaryIdentity, {
            accessToken: 'access-1',
            expiresAt: new Date(2_000_000),
            refreshToken: 'refresh-1',
            scopes: ['listings_r'],
            tokenType: 'Bearer'
        });

        const status = await service.disconnectOAuthSession(primaryIdentity);

        expect(status).toEqual({
            connected: false,
            expiresAt: null,
            needsRefresh: false,
            scopes: []
        });

        await expect(service.getOAuthAccessToken(primaryIdentity)).rejects.toMatchObject({
            code: 'PRECONDITION_FAILED',
            message: 'Etsy OAuth is not connected. Run the start flow first.'
        });
    });
});
