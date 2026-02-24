import { afterEach, describe, expect, mock, test } from 'bun:test';
import { env } from '../../../config/env';
import { resetEtsyRateLimitStateForTests } from '../fetch-etsy-api';
import { EtsyGetListingBridgeError, getListing } from './get-listing';

const originalFetch = globalThis.fetch;
const originalEtsyApiSharedSecret = env.ETSY_API_SHARED_SECRET;

afterEach(() => {
    globalThis.fetch = originalFetch;
    env.ETSY_API_SHARED_SECRET = originalEtsyApiSharedSecret;
    resetEtsyRateLimitStateForTests();
});

describe('get-listing bridge', () => {
    test('maps Etsy listing response into normalized output', async () => {
        globalThis.fetch = mock(async () => {
            return new Response(
                JSON.stringify({
                    description: 'Sample description',
                    listing_id: 1234567890,
                    num_favorers: 22,
                    price: {
                        amount: 2550,
                        currency_code: 'USD',
                        divisor: 100
                    },
                    quantity: 7,
                    shop: {
                        shop_name: 'Needle & Oak'
                    },
                    shop_id: 987654321,
                    state: 'active',
                    tags: ['tag-a'],
                    title: 'Sample Listing',
                    updated_timestamp: 1739400000,
                    url: 'https://www.etsy.com/listing/1234567890/sample-listing',
                    views: 1234
                }),
                {
                    status: 200
                }
            );
        }) as unknown as typeof fetch;

        const response = await getListing({
            accessToken: 'token-1',
            listingId: '1234567890'
        });

        expect(response).toMatchObject({
            description: 'Sample description',
            etsyState: 'active',
            listingId: '1234567890',
            numFavorers: 22,
            price: {
                amount: 2550,
                currencyCode: 'USD',
                divisor: 100
            },
            quantity: 7,
            shopId: '987654321',
            shopName: 'Needle & Oak',
            tags: ['tag-a'],
            title: 'Sample Listing',
            updatedTimestamp: 1739400000,
            url: 'https://www.etsy.com/listing/1234567890/sample-listing',
            views: 1234
        });

        expect(response.images).toEqual([]);
        expect(response.videos).toEqual([]);
    });

    test('passes documented OpenAPI query params to getListing', async () => {
        let requestedUrl = '';

        globalThis.fetch = mock(async (input: RequestInfo | URL) => {
            requestedUrl = String(input);

            return new Response(
                JSON.stringify({
                    listing_id: 1234567890,
                    state: 'active',
                    title: 'Sample Listing'
                }),
                {
                    status: 200
                }
            );
        }) as unknown as typeof fetch;

        await getListing({
            accessToken: 'token-1',
            allowSuggestedTitle: true,
            includes: ['Shop', 'Images'],
            language: 'en',
            legacy: true,
            listingId: '1234567890'
        });

        const url = new URL(requestedUrl);

        expect(url.pathname).toBe('/v3/application/listings/1234567890');
        expect(url.searchParams.getAll('includes')).toEqual(['Shop', 'Images']);
        expect(url.searchParams.get('language')).toBe('en');
        expect(url.searchParams.get('legacy')).toBe('true');
        expect(url.searchParams.get('allow_suggested_title')).toBe('true');
    });

    test('sends key:secret in x-api-key header when shared secret is configured', async () => {
        env.ETSY_API_SHARED_SECRET = 'shared-secret-1';

        let xApiKeyHeader: string | null = null;

        globalThis.fetch = mock(async (_input, init) => {
            xApiKeyHeader = new Headers(init?.headers).get('x-api-key');

            return new Response(
                JSON.stringify({
                    listing_id: 1234567890,
                    state: 'active',
                    title: 'Sample Listing'
                }),
                {
                    status: 200
                }
            );
        }) as unknown as typeof fetch;

        await getListing({
            accessToken: 'token-1',
            listingId: '1234567890'
        });

        if (typeof xApiKeyHeader !== 'string') {
            throw new Error('x-api-key header was not sent');
        }

        expect(xApiKeyHeader === `${env.ETSY_API_KEY}:shared-secret-1`).toBe(true);
    });

    test('throws EtsyGetListingBridgeError for non-2xx responses', async () => {
        globalThis.fetch = mock(async () => {
            return new Response(
                JSON.stringify({
                    error: 'Not Found',
                    message: 'Listing missing'
                }),
                {
                    status: 404
                }
            );
        }) as unknown as typeof fetch;

        await expect(
            getListing({
                accessToken: 'token-1',
                listingId: '123'
            })
        ).rejects.toBeInstanceOf(EtsyGetListingBridgeError);
    });

    test('rejects invalid listing id input before calling Etsy', async () => {
        await expect(
            getListing({
                accessToken: 'token-1',
                listingId: 'not-a-number'
            })
        ).rejects.toBeInstanceOf(EtsyGetListingBridgeError);
    });
});
