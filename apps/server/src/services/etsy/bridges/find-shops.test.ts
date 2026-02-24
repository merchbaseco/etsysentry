import { afterEach, describe, expect, mock, test } from 'bun:test';
import { env } from '../../../config/env';
import { resetEtsyRateLimitStateForTests } from '../fetch-etsy-api';
import { EtsyFindShopsBridgeError, findShops } from './find-shops';

const originalFetch = globalThis.fetch;
const originalEtsyApiSharedSecret = env.ETSY_API_SHARED_SECRET;

afterEach(() => {
    globalThis.fetch = originalFetch;
    env.ETSY_API_SHARED_SECRET = originalEtsyApiSharedSecret;
    resetEtsyRateLimitStateForTests();
});

describe('find-shops bridge', () => {
    test('maps Etsy findShops response into normalized output', async () => {
        globalThis.fetch = mock(async () => {
            return new Response(
                JSON.stringify({
                    count: 2,
                    results: [
                        {
                            shop_id: 99887766,
                            shop_name: 'Needle and Oak',
                            url: 'https://www.etsy.com/shop/needleandoak'
                        },
                        {
                            shop_id: 77665544,
                            shop_name: 'Needle and Oak Supply',
                            url: null
                        }
                    ]
                }),
                {
                    status: 200
                }
            );
        }) as unknown as typeof fetch;

        const response = await findShops({
            limit: 25,
            offset: 0,
            shopName: 'needleandoak'
        });

        expect(response).toEqual({
            count: 2,
            results: [
                {
                    shopId: '99887766',
                    shopName: 'Needle and Oak',
                    url: 'https://www.etsy.com/shop/needleandoak'
                },
                {
                    shopId: '77665544',
                    shopName: 'Needle and Oak Supply',
                    url: null
                }
            ]
        });
    });

    test('passes documented OpenAPI query params to findShops', async () => {
        let requestedUrl = '';

        globalThis.fetch = mock(async (input: RequestInfo | URL) => {
            requestedUrl = String(input);

            return new Response(
                JSON.stringify({
                    count: 0,
                    results: []
                }),
                {
                    status: 200
                }
            );
        }) as unknown as typeof fetch;

        await findShops({
            limit: 30,
            offset: 20,
            shopName: 'needleandoak'
        });

        const url = new URL(requestedUrl);

        expect(url.pathname).toBe('/v3/application/shops');
        expect(url.searchParams.get('shop_name')).toBe('needleandoak');
        expect(url.searchParams.get('limit')).toBe('30');
        expect(url.searchParams.get('offset')).toBe('20');
    });

    test('sends key:secret in x-api-key header when shared secret is configured', async () => {
        env.ETSY_API_SHARED_SECRET = 'shared-secret-1';

        let xApiKeyHeader: string | null = null;

        globalThis.fetch = mock(async (_input, init) => {
            xApiKeyHeader = new Headers(init?.headers).get('x-api-key');

            return new Response(
                JSON.stringify({
                    count: 0,
                    results: []
                }),
                {
                    status: 200
                }
            );
        }) as unknown as typeof fetch;

        await findShops({
            shopName: 'needleandoak'
        });

        if (typeof xApiKeyHeader !== 'string') {
            throw new Error('x-api-key header was not sent');
        }

        expect(xApiKeyHeader === `${env.ETSY_API_KEY}:shared-secret-1`).toBe(true);
    });

    test('throws EtsyFindShopsBridgeError for non-2xx responses', async () => {
        globalThis.fetch = mock(async () => {
            return new Response(
                JSON.stringify({
                    error: 'Not Found',
                    message: 'No shops found'
                }),
                {
                    status: 404
                }
            );
        }) as unknown as typeof fetch;

        await expect(
            findShops({
                shopName: 'needleandoak'
            })
        ).rejects.toBeInstanceOf(EtsyFindShopsBridgeError);
    });

    test('rejects invalid input before calling Etsy', async () => {
        await expect(
            findShops({
                shopName: ''
            })
        ).rejects.toBeInstanceOf(EtsyFindShopsBridgeError);
    });
});
