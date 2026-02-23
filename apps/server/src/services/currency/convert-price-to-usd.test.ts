import { describe, expect, test } from 'bun:test';
import { convertPriceToUsd } from './convert-price-to-usd';

describe('convertPriceToUsd', () => {
    test('returns original value for USD prices', () => {
        const result = convertPriceToUsd({
            currencyCode: 'USD',
            ratesByCurrencyCode: {
                CAD: 1.4,
                USD: 1
            },
            value: 12.5
        });

        expect(result).toBe(12.5);
    });

    test('converts foreign currency values to USD using USD-based rates', () => {
        const result = convertPriceToUsd({
            currencyCode: 'CAD',
            ratesByCurrencyCode: {
                CAD: 1.4,
                USD: 1
            },
            value: 28
        });

        expect(result).toBe(20);
    });

    test('returns null when rates are unavailable for the currency code', () => {
        const result = convertPriceToUsd({
            currencyCode: 'MAD',
            ratesByCurrencyCode: {
                CAD: 1.4
            },
            value: 100
        });

        expect(result).toBeNull();
    });
});
