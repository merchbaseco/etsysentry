import { afterEach, describe, expect, mock, test } from 'bun:test';
import { resetEtsyRateLimitStateForTests } from '../fetch-etsy-api';
import { exchangeOAuthToken, EtsyOAuthBridgeError } from './exchange-oauth-token';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
    resetEtsyRateLimitStateForTests();
});

describe('exchange-oauth-token bridge', () => {
    test('parses whitespace-delimited scopes from token response', async () => {
        globalThis.fetch = mock(async () => {
            return new Response(
                JSON.stringify({
                    access_token: 'access-1',
                    expires_in: 3600,
                    refresh_token: 'refresh-1',
                    scope: 'listings_r shops_r',
                    token_type: 'Bearer'
                }),
                {
                    status: 200
                }
            );
        }) as unknown as typeof fetch;

        const response = await exchangeOAuthToken({
            grantType: 'refresh_token',
            refreshToken: 'refresh-1'
        });

        expect(response.scopes).toEqual(['listings_r', 'shops_r']);
    });

    test('parses comma-delimited scopes from token response', async () => {
        globalThis.fetch = mock(async () => {
            return new Response(
                JSON.stringify({
                    access_token: 'access-1',
                    expires_in: 3600,
                    refresh_token: 'refresh-1',
                    scope: 'listings_r,shops_r',
                    token_type: 'Bearer'
                }),
                {
                    status: 200
                }
            );
        }) as unknown as typeof fetch;

        const response = await exchangeOAuthToken({
            grantType: 'refresh_token',
            refreshToken: 'refresh-1'
        });

        expect(response.scopes).toEqual(['listings_r', 'shops_r']);
    });

    test('throws EtsyOAuthBridgeError for non-2xx responses', async () => {
        globalThis.fetch = mock(async () => {
            return new Response(
                JSON.stringify({
                    error: 'invalid_scope',
                    error_description: 'Scope is invalid'
                }),
                {
                    status: 400
                }
            );
        }) as unknown as typeof fetch;

        await expect(
            exchangeOAuthToken({
                grantType: 'refresh_token',
                refreshToken: 'refresh-1'
            })
        ).rejects.toBeInstanceOf(EtsyOAuthBridgeError);
    });
});
