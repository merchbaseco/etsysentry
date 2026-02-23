import { FetchUsdRatesError, fetchUsdRates } from './fetch-usd-rates';
import { saveUsdRatesCache, saveUsdRatesRefreshError } from './save-usd-rates-cache';

export const USD_RATES_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

export class SyncUsdRatesError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SyncUsdRatesError';
    }
}

export const syncUsdRates = async (): Promise<void> => {
    const nextRefreshAt = new Date(Date.now() + USD_RATES_REFRESH_INTERVAL_MS);

    try {
        const latestRates = await fetchUsdRates();

        await saveUsdRatesCache({
            fetchedAt: latestRates.fetchedAt,
            nextRefreshAt,
            provider: latestRates.provider,
            rates: latestRates.rates
        });
    } catch (error) {
        const message =
            error instanceof FetchUsdRatesError
                ? error.message
                : 'Unexpected USD rates sync failure.';

        await saveUsdRatesRefreshError({
            errorMessage: message,
            nextRefreshAt,
            provider: 'open.er-api.com'
        });

        throw new SyncUsdRatesError(message);
    }
};
