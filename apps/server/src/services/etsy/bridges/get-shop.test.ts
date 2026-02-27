import { afterEach, describe, expect, mock, test } from 'bun:test';
import { env } from '../../../config/env';
import { resetEtsyRateLimitStateForTests } from '../fetch-etsy-api';
import { EtsyGetShopBridgeError, getShop } from './get-shop';

const originalFetch = globalThis.fetch;
const originalEtsyApiSharedSecret = env.ETSY_API_SHARED_SECRET;

afterEach(() => {
    globalThis.fetch = originalFetch;
    env.ETSY_API_SHARED_SECRET = originalEtsyApiSharedSecret;
    resetEtsyRateLimitStateForTests();
});

describe('get-shop bridge', () => {
    test('maps Etsy getShop response into normalized output', async () => {
        globalThis.fetch = mock(() => {
            return new Response(
                JSON.stringify({
                    listing_active_count: 152,
                    num_favorers: 912,
                    review_count: 77,
                    shop_id: 99_887_766,
                    shop_name: 'Needle and Oak',
                    transaction_sold_count: 3120,
                    updated_timestamp: 1_739_400_000,
                    url: 'https://www.etsy.com/shop/needleandoak',
                }),
                {
                    status: 200,
                }
            );
        }) as unknown as typeof fetch;

        const response = await getShop({
            shopId: '99887766',
        });

        expect(response).toEqual({
            activeListingCount: 152,
            numFavorers: 912,
            reviewCount: 77,
            shopId: '99887766',
            shopName: 'Needle and Oak',
            soldCount: 3120,
            updatedTimestamp: 1_739_400_000,
            url: 'https://www.etsy.com/shop/needleandoak',
        });
    });

    test('passes documented OpenAPI path params to getShop', async () => {
        let requestedUrl = '';

        globalThis.fetch = mock((input: RequestInfo | URL) => {
            requestedUrl = String(input);

            return new Response(
                JSON.stringify({
                    shop_id: 99_887_766,
                    shop_name: 'Needle and Oak',
                }),
                {
                    status: 200,
                }
            );
        }) as unknown as typeof fetch;

        await getShop({
            shopId: '99887766',
        });

        const url = new URL(requestedUrl);

        expect(url.pathname).toBe('/v3/application/shops/99887766');
    });

    test('sends key:secret in x-api-key header when shared secret is configured', async () => {
        env.ETSY_API_SHARED_SECRET = 'shared-secret-1';

        let xApiKeyHeader: string | null = null;

        globalThis.fetch = mock((_input, init) => {
            xApiKeyHeader = new Headers(init?.headers).get('x-api-key');

            return new Response(
                JSON.stringify({
                    shop_id: 99_887_766,
                    shop_name: 'Needle and Oak',
                }),
                {
                    status: 200,
                }
            );
        }) as unknown as typeof fetch;

        await getShop({
            shopId: '99887766',
        });

        if (typeof xApiKeyHeader !== 'string') {
            throw new Error('x-api-key header was not sent');
        }

        expect(xApiKeyHeader === `${env.ETSY_API_KEY}:shared-secret-1`).toBe(true);
    });

    test('throws EtsyGetShopBridgeError for non-2xx responses', async () => {
        globalThis.fetch = mock(() => {
            return new Response(
                JSON.stringify({
                    error: 'Not Found',
                    message: 'Shop missing',
                }),
                {
                    status: 404,
                }
            );
        }) as unknown as typeof fetch;

        await expect(
            getShop({
                shopId: '99887766',
            })
        ).rejects.toBeInstanceOf(EtsyGetShopBridgeError);
    });

    test('rejects invalid input before calling Etsy', async () => {
        await expect(
            getShop({
                shopId: 'shop-name',
            })
        ).rejects.toBeInstanceOf(EtsyGetShopBridgeError);
    });
});
