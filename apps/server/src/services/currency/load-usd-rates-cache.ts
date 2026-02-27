import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { currencyRates } from '../../db/schema';

const USD_BASE_CURRENCY = 'USD';
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const ratesSchema = z.record(z.string(), z.coerce.number().positive());

const parseRatesJson = (rawValue: string | null): Record<string, number> | null => {
    if (!rawValue) {
        return null;
    }

    try {
        const parsed = JSON.parse(rawValue);
        const validated = ratesSchema.safeParse(parsed);

        return validated.success ? validated.data : null;
    } catch {
        return null;
    }
};

export interface UsdRatesStatus {
    baseCurrency: string;
    fetchedAt: string | null;
    hasRates: boolean;
    isStale: boolean;
    lastRefreshError: string | null;
    nextRefreshAt: string | null;
    provider: string;
    rateCount: number;
}

const defaultStatus: UsdRatesStatus = {
    baseCurrency: USD_BASE_CURRENCY,
    fetchedAt: null,
    hasRates: false,
    isStale: true,
    lastRefreshError: null,
    nextRefreshAt: null,
    provider: 'open.er-api.com',
    rateCount: 0,
};

export const loadUsdRatesStatus = async (params?: { now?: Date }): Promise<UsdRatesStatus> => {
    const now = params?.now ?? new Date();
    const [row] = await db
        .select()
        .from(currencyRates)
        .where(eq(currencyRates.baseCurrency, USD_BASE_CURRENCY))
        .limit(1);

    if (!row) {
        return defaultStatus;
    }

    const parsedRates = parseRatesJson(row.ratesJson ?? null);
    const fetchedAtTimestamp = row.fetchedAt?.getTime() ?? null;
    const isStale =
        fetchedAtTimestamp === null || now.getTime() - fetchedAtTimestamp > STALE_THRESHOLD_MS;

    return {
        baseCurrency: row.baseCurrency,
        fetchedAt: row.fetchedAt ? row.fetchedAt.toISOString() : null,
        hasRates: parsedRates !== null,
        isStale,
        lastRefreshError: row.lastRefreshError ?? null,
        nextRefreshAt: row.nextRefreshAt ? row.nextRefreshAt.toISOString() : null,
        provider: row.provider,
        rateCount: parsedRates ? Object.keys(parsedRates).length : 0,
    };
};

export const loadUsdRatesMap = async (): Promise<Record<string, number> | null> => {
    const [row] = await db
        .select({
            ratesJson: currencyRates.ratesJson,
        })
        .from(currencyRates)
        .where(eq(currencyRates.baseCurrency, USD_BASE_CURRENCY))
        .limit(1);

    if (!row) {
        return null;
    }

    return parseRatesJson(row.ratesJson ?? null);
};
