import { afterEach, describe, expect, mock, test } from 'bun:test';
import { env } from '../../../config/env';
import { resetEtsyRateLimitStateForTests } from '../fetch-etsy-api';
import {
    EtsyFindAllListingsActiveBridgeError,
    findAllListingsActive
} from './find-all-listings-active';

const originalFetch = globalThis.fetch;
const originalEtsyApiSharedSecret = env.ETSY_API_SHARED_SECRET;

afterEach(() => {
    globalThis.fetch = originalFetch;
    env.ETSY_API_SHARED_SECRET = originalEtsyApiSharedSecret;
    resetEtsyRateLimitStateForTests();
});

describe('find-all-listings-active bridge', () => {
    test('maps Etsy search response into normalized output', async () => {
        globalThis.fetch = mock(async () => {
            return new Response(
                JSON.stringify({
                    count: 2,
                    results: [
                        {
                            listing_id: 1234567890,
                            main_image: {
                                url_170x135:
                                    'https://i.etsystatic.com/123/il/abc123/1234567890/il_170x135.jpg'
                            },
                            price: {
                                amount: 4500,
                                currency_code: 'USD',
                                divisor: 100
                            },
                            shop_id: 99112233,
                            title: 'Mid Century Print',
                            url: 'https://www.etsy.com/listing/1234567890/mid-century-print'
                        },
                        {
                            listing_id: 1122334455,
                            price: null,
                            title: 'Vintage Lamp',
                            url: null
                        }
                    ]
                }),
                {
                    status: 200
                }
            );
        }) as unknown as typeof fetch;

        const response = await findAllListingsActive({
            accessToken: 'token-1',
            keywords: 'mid century wall art',
            limit: 25,
            offset: 0,
            sortOn: 'score'
        });

        expect(response).toEqual({
            count: 2,
            results: [
                {
                    listingId: '1234567890',
                    price: {
                        amount: 4500,
                        currencyCode: 'USD',
                        divisor: 100
                    },
                    shopId: '99112233',
                    thumbnailUrl:
                        'https://i.etsystatic.com/123/il/abc123/1234567890/il_170x135.jpg',
                    title: 'Mid Century Print',
                    url: 'https://www.etsy.com/listing/1234567890/mid-century-print'
                },
                {
                    listingId: '1122334455',
                    price: null,
                    shopId: null,
                    thumbnailUrl: null,
                    title: 'Vintage Lamp',
                    url: null
                }
            ]
        });
    });

    test('passes documented OpenAPI query params to findAllListingsActive', async () => {
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

        await findAllListingsActive({
            accessToken: 'token-1',
            keywords: 'mid century',
            legacy: true,
            limit: 30,
            maxPrice: 100,
            minPrice: 25,
            offset: 20,
            shopLocation: 'New York',
            sortOn: 'score',
            sortOrder: 'desc',
            taxonomyId: 123
        });

        const url = new URL(requestedUrl);

        expect(url.pathname).toBe('/v3/application/listings/active');
        expect(url.searchParams.get('keywords')).toBe('mid century');
        expect(url.searchParams.get('limit')).toBe('30');
        expect(url.searchParams.get('offset')).toBe('20');
        expect(url.searchParams.get('sort_on')).toBe('score');
        expect(url.searchParams.get('sort_order')).toBe('desc');
        expect(url.searchParams.get('min_price')).toBe('25');
        expect(url.searchParams.get('max_price')).toBe('100');
        expect(url.searchParams.get('taxonomy_id')).toBe('123');
        expect(url.searchParams.get('shop_location')).toBe('New York');
        expect(url.searchParams.get('legacy')).toBe('true');
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

        await findAllListingsActive({
            accessToken: 'token-1',
            keywords: 'test'
        });

        if (typeof xApiKeyHeader !== 'string') {
            throw new Error('x-api-key header was not sent');
        }

        expect(xApiKeyHeader === `${env.ETSY_API_KEY}:shared-secret-1`).toBe(true);
    });

    test('throws EtsyFindAllListingsActiveBridgeError for non-2xx responses', async () => {
        globalThis.fetch = mock(async () => {
            return new Response(
                JSON.stringify({
                    error: 'Not Found',
                    message: 'Resource missing'
                }),
                {
                    status: 404
                }
            );
        }) as unknown as typeof fetch;

        await expect(
            findAllListingsActive({
                accessToken: 'token-1',
                keywords: 'wall art'
            })
        ).rejects.toBeInstanceOf(EtsyFindAllListingsActiveBridgeError);
    });

    test('rejects invalid input before calling Etsy', async () => {
        await expect(
            findAllListingsActive({
                accessToken: '',
                keywords: 'wall art'
            })
        ).rejects.toBeInstanceOf(EtsyFindAllListingsActiveBridgeError);
    });
});
