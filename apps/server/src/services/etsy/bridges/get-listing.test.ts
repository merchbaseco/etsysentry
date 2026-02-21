import { afterEach, describe, expect, mock, test } from 'bun:test';
import { EtsyGetListingBridgeError, getListing } from './get-listing';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
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
