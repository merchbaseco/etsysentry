import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { currencyRates } from '../../db/schema';

const USD_BASE_CURRENCY = 'USD';

export const saveUsdRatesCache = async (params: {
    fetchedAt: Date;
    nextRefreshAt: Date;
    provider: string;
    rates: Record<string, number>;
}): Promise<void> => {
    const now = new Date();

    await db
        .insert(currencyRates)
        .values({
            baseCurrency: USD_BASE_CURRENCY,
            fetchedAt: params.fetchedAt,
            lastRefreshError: null,
            nextRefreshAt: params.nextRefreshAt,
            provider: params.provider,
            ratesJson: JSON.stringify(params.rates),
            updatedAt: now
        })
        .onConflictDoUpdate({
            set: {
                fetchedAt: params.fetchedAt,
                lastRefreshError: null,
                nextRefreshAt: params.nextRefreshAt,
                provider: params.provider,
                ratesJson: JSON.stringify(params.rates),
                updatedAt: now
            },
            target: currencyRates.baseCurrency
        });
};

export const saveUsdRatesRefreshError = async (params: {
    errorMessage: string;
    nextRefreshAt: Date;
    provider: string;
}): Promise<void> => {
    const now = new Date();
    const [existing] = await db
        .select()
        .from(currencyRates)
        .where(eq(currencyRates.baseCurrency, USD_BASE_CURRENCY))
        .limit(1);

    if (!existing) {
        await db.insert(currencyRates).values({
            baseCurrency: USD_BASE_CURRENCY,
            fetchedAt: null,
            lastRefreshError: params.errorMessage,
            nextRefreshAt: params.nextRefreshAt,
            provider: params.provider,
            ratesJson: null,
            updatedAt: now
        });
        return;
    }

    await db
        .update(currencyRates)
        .set({
            lastRefreshError: params.errorMessage,
            nextRefreshAt: params.nextRefreshAt,
            updatedAt: now
        })
        .where(eq(currencyRates.baseCurrency, USD_BASE_CURRENCY));
};
