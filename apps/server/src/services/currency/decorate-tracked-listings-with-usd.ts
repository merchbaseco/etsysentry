import type { TrackedListingRecord } from '../listings/tracked-listings-service';
import { convertPriceToUsd } from './convert-price-to-usd';
import { loadUsdRatesMap } from './load-usd-rates-cache';

export type TrackedListingWithUsd = TrackedListingRecord & {
    priceUsdValue: number | null;
};

const addUsdPrice = (
    item: TrackedListingRecord,
    ratesByCurrencyCode: Record<string, number> | null
): TrackedListingWithUsd => {
    const priceUsdValue = item.price
        ? convertPriceToUsd({
              currencyCode: item.price.currencyCode,
              ratesByCurrencyCode,
              value: item.price.value
          })
        : null;

    return {
        ...item,
        priceUsdValue
    };
};

export const decorateTrackedListingWithUsd = async (
    item: TrackedListingRecord
): Promise<TrackedListingWithUsd> => {
    const ratesByCurrencyCode = await loadUsdRatesMap();

    return addUsdPrice(item, ratesByCurrencyCode);
};

export const decorateTrackedListingsWithUsd = async (
    items: TrackedListingRecord[]
): Promise<TrackedListingWithUsd[]> => {
    const ratesByCurrencyCode = await loadUsdRatesMap();

    return items.map((item) => addUsdPrice(item, ratesByCurrencyCode));
};
