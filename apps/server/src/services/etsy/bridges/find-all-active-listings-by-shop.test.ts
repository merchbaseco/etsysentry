import { afterEach, describe, expect, mock, test } from 'bun:test';
import { env } from '../../../config/env';
import { resetEtsyRateLimitStateForTests } from '../fetch-etsy-api';
import {
    EtsyFindAllActiveListingsByShopBridgeError,
    findAllActiveListingsByShop,
} from './find-all-active-listings-by-shop';

const originalFetch = globalThis.fetch;
const originalEtsyApiSharedSecret = env.ETSY_API_SHARED_SECRET;

afterEach(() => {
    globalThis.fetch = originalFetch;
    env.ETSY_API_SHARED_SECRET = originalEtsyApiSharedSecret;
    resetEtsyRateLimitStateForTests();
});

describe('find-all-active-listings-by-shop bridge', () => {
    test('maps Etsy response into normalized output', async () => {
        globalThis.fetch = mock(() => {
            return new Response(
                JSON.stringify({
                    count: 2,
                    results: [
                        {
                            listing_id: 1_234_567_890,
                            listing_type: 'physical',
                            num_favorers: 45,
                            price: {
                                amount: 4500,
                                currency_code: 'USD',
                                divisor: 100,
                            },
                            quantity: 7,
                            shop_id: 99_887_766,
                            state: 'active',
                            title: 'Mid Century Print',
                            updated_timestamp: 1_739_400_000,
                            url: 'https://www.etsy.com/listing/1234567890/mid-century-print',
                        },
                        {
                            listing_id: 1_122_334_455,
                            listing_type: 'download',
                            price: null,
                            title: 'Vintage Lamp',
                            updated_timestamp: null,
                            url: null,
                        },
                    ],
                }),
                {
                    status: 200,
                }
            );
        }) as unknown as typeof fetch;

        const response = await findAllActiveListingsByShop({
            limit: 25,
            offset: 0,
            shopId: '99887766',
            sortOn: 'updated',
            sortOrder: 'desc',
        });

        expect(response).toEqual({
            count: 2,
            results: [
                {
                    etsyState: 'active',
                    listingId: '1234567890',
                    listingType: 'physical',
                    numFavorers: 45,
                    price: {
                        amount: 4500,
                        currencyCode: 'USD',
                        divisor: 100,
                    },
                    quantity: 7,
                    shopId: '99887766',
                    title: 'Mid Century Print',
                    updatedTimestamp: 1_739_400_000,
                    url: 'https://www.etsy.com/listing/1234567890/mid-century-print',
                },
                {
                    etsyState: null,
                    listingId: '1122334455',
                    listingType: 'download',
                    numFavorers: null,
                    price: null,
                    quantity: null,
                    shopId: null,
                    title: 'Vintage Lamp',
                    updatedTimestamp: null,
                    url: null,
                },
            ],
        });
    });

    test('passes documented OpenAPI query params to findAllActiveListingsByShop', async () => {
        let requestedUrl = '';

        globalThis.fetch = mock((input: RequestInfo | URL) => {
            requestedUrl = String(input);

            return new Response(
                JSON.stringify({
                    count: 0,
                    results: [],
                }),
                {
                    status: 200,
                }
            );
        }) as unknown as typeof fetch;

        await findAllActiveListingsByShop({
            keywords: 'wall art',
            legacy: true,
            limit: 30,
            offset: 20,
            shopId: '99887766',
            sortOn: 'updated',
            sortOrder: 'desc',
        });

        const url = new URL(requestedUrl);

        expect(url.pathname).toBe('/v3/application/shops/99887766/listings/active');
        expect(url.searchParams.get('keywords')).toBe('wall art');
        expect(url.searchParams.get('legacy')).toBe('true');
        expect(url.searchParams.get('limit')).toBe('30');
        expect(url.searchParams.get('offset')).toBe('20');
        expect(url.searchParams.get('sort_on')).toBe('updated');
        expect(url.searchParams.get('sort_order')).toBe('desc');
    });

    test('sends key:secret in x-api-key header when shared secret is configured', async () => {
        env.ETSY_API_SHARED_SECRET = 'shared-secret-1';

        let xApiKeyHeader: string | null = null;

        globalThis.fetch = mock((_input, init) => {
            xApiKeyHeader = new Headers(init?.headers).get('x-api-key');

            return new Response(
                JSON.stringify({
                    count: 0,
                    results: [],
                }),
                {
                    status: 200,
                }
            );
        }) as unknown as typeof fetch;

        await findAllActiveListingsByShop({
            shopId: '99887766',
        });

        if (typeof xApiKeyHeader !== 'string') {
            throw new Error('x-api-key header was not sent');
        }

        expect(xApiKeyHeader === `${env.ETSY_API_KEY}:shared-secret-1`).toBe(true);
    });

    test('throws EtsyFindAllActiveListingsByShopBridgeError for non-2xx responses', async () => {
        globalThis.fetch = mock(() => {
            return new Response(
                JSON.stringify({
                    error: 'Not Found',
                    message: 'Resource missing',
                }),
                {
                    status: 404,
                }
            );
        }) as unknown as typeof fetch;

        await expect(
            findAllActiveListingsByShop({
                shopId: '99887766',
            })
        ).rejects.toBeInstanceOf(EtsyFindAllActiveListingsByShopBridgeError);
    });

    test('rejects invalid input before calling Etsy', async () => {
        await expect(
            findAllActiveListingsByShop({
                shopId: 'not-a-number',
            })
        ).rejects.toBeInstanceOf(EtsyFindAllActiveListingsByShopBridgeError);
    });
});
