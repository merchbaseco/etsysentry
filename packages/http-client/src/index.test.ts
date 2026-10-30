import { describe, expect, test } from 'bun:test';
import { createRequestHeaders, DEFAULT_API_BASE_URL } from './index';

describe('createRequestHeaders', () => {
    test('translates the strict native API key envelope to Cloudflare service headers', () => {
        expect(
            createRequestHeaders({
                apiKey: 'mbk_v1.eyJjbGllbnRJZCI6ImV0c3ktY2xpIiwiY2xpZW50U2VjcmV0IjoiMDEyMzQ1Njc4OWFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6In0',
            })
        ).toEqual({
            'CF-Access-Client-Id': 'etsy-cli',
            'CF-Access-Client-Secret': '0123456789abcdefghijklmnopqrstuvwxyz',
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
                apiKey: 'mbk_v1.eyJjbGllbnRJZCI6ImV0c3ktY2xpIiwiY2xpZW50U2VjcmV0IjoiMDEyMzQ1Njc4OWFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6In0',
            })
        ).toThrow('Provide either an API key or an OAuth access token, not both.');
    });

    test('defaults to the protected API hostname', () => {
        expect(DEFAULT_API_BASE_URL).toBe('https://etsysentry-api.merchbase.co');
    });
});
