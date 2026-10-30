import { describe, expect, test } from 'bun:test';
import { createRequestHeaders, DEFAULT_API_BASE_URL } from './index';

const nativeApiKey = `mbk_v1.${Buffer.from(
    JSON.stringify({
        clientId: 'etsy-cli',
        clientSecret: 'test-only-client-secret'.repeat(2),
    })
).toString('base64url')}`;

describe('createRequestHeaders', () => {
    test('translates the strict native API key envelope to Cloudflare service headers', () => {
        expect(
            createRequestHeaders({
                apiKey: nativeApiKey,
            })
        ).toEqual({
            'CF-Access-Client-Id': 'etsy-cli',
            'CF-Access-Client-Secret': 'test-only-client-secrettest-only-client-secret',
        });
    });

    test('preserves an opaque OAuth bearer without inspecting its format', () => {
        expect(createRequestHeaders({ accessToken: 'oauth:not.a.jwt' })).toEqual({
            Authorization: 'Bearer oauth:not.a.jwt',
        });
    });

    test('rejects malformed or legacy values in the native key slot', () => {
        for (const apiKey of [
            'ak_test',
            'mbk_v1.=not-base64url',
            'mbk_v1.eyJjbGllbnRJZCI6IngifQ',
        ]) {
            expect(() => createRequestHeaders({ apiKey })).toThrow('Invalid Merchbase API key.');
        }
    });

    test('keeps the API key and OAuth token inputs separate', () => {
        expect(() =>
            createRequestHeaders({
                accessToken: 'oauth:opaque',
                apiKey: nativeApiKey,
            })
        ).toThrow('Provide either an API key or an OAuth access token, not both.');
    });

    test('defaults to the protected API hostname', () => {
        expect(DEFAULT_API_BASE_URL).toBe('https://etsysentry-api.merchbase.co');
    });
});
