import { afterEach, describe, expect, mock, test } from 'bun:test';
import { FetchUsdRatesError, fetchUsdRates } from './fetch-usd-rates';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe('fetchUsdRates', () => {
    test('maps provider response into normalized USD rate payload', async () => {
        globalThis.fetch = mock(() => {
            return new Response(
                JSON.stringify({
                    base_code: 'USD',
                    rates: {
                        CAD: 1.4,
                        USD: 1,
                    },
                    result: 'success',
                    time_last_update_unix: 1_771_860_000,
                    time_next_update_unix: 1_771_946_400,
                }),
                {
                    status: 200,
                }
            );
        }) as unknown as typeof fetch;

        const response = await fetchUsdRates();

        expect(response.provider).toBe('open.er-api.com');
        expect(response.rates).toEqual({
            CAD: 1.4,
            USD: 1,
        });
        expect(response.fetchedAt.toISOString()).toBe('2026-02-23T15:20:00.000Z');
        expect(response.nextProviderUpdateAt.toISOString()).toBe('2026-02-24T15:20:00.000Z');
    });

    test('throws FetchUsdRatesError for non-2xx provider responses', async () => {
        globalThis.fetch = mock(() => {
            return new Response(
                JSON.stringify({
                    'error-type': 'rate limited',
                    result: 'error',
                }),
                {
                    status: 429,
                }
            );
        }) as unknown as typeof fetch;

        await expect(fetchUsdRates()).rejects.toBeInstanceOf(FetchUsdRatesError);
    });

    test('throws FetchUsdRatesError when required fields are missing', async () => {
        globalThis.fetch = mock(() => {
            return new Response(
                JSON.stringify({
                    result: 'success',
                }),
                {
                    status: 200,
                }
            );
        }) as unknown as typeof fetch;

        await expect(fetchUsdRates()).rejects.toBeInstanceOf(FetchUsdRatesError);
    });
});
