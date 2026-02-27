import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../db';
import { etsyApiCallEvents } from '../../db/schema';
import {
    type EtsyRateLimitRuntimeSnapshot,
    getEtsyRateLimitRuntimeSnapshot,
} from './etsy-rate-limit-runtime';

export interface EtsyApiUsageStats {
    callsPast5Minutes: number;
    callsPast24Hours: number;
    callsPastHour: number;
    lastCallAt: Date | null;
}

export interface EtsyApiUsage {
    rateLimit: EtsyRateLimitRuntimeSnapshot;
    stats: EtsyApiUsageStats;
}

type DbTimestampValue = Date | string | null;

export const parseDbTimestamp = (value: DbTimestampValue): Date | null => {
    if (value === null) {
        return null;
    }

    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            throw new Error('Received invalid Date for Etsy API usage timestamp.');
        }

        return value;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Received invalid timestamp string for Etsy API usage: ${value}`);
    }

    return parsed;
};

const countApiCallsSince = async (params: {
    accountId: string;
    threshold: Date;
}): Promise<number> => {
    const [row] = await db
        .select({
            value: sql<number>`count(*)::int`,
        })
        .from(etsyApiCallEvents)
        .where(
            and(
                eq(etsyApiCallEvents.accountId, params.accountId),
                gte(etsyApiCallEvents.createdAt, params.threshold)
            )
        );

    return row?.value ?? 0;
};

const getLastApiCallTimestamp = async (params: { accountId: string }): Promise<Date | null> => {
    const [row] = await db
        .select({
            value: sql<DbTimestampValue>`max(${etsyApiCallEvents.createdAt})`,
        })
        .from(etsyApiCallEvents)
        .where(eq(etsyApiCallEvents.accountId, params.accountId));

    return parseDbTimestamp(row?.value ?? null);
};

export const getEtsyApiUsage = async (params: { accountId: string }): Promise<EtsyApiUsage> => {
    const nowMs = Date.now();
    const fiveMinutesAgo = new Date(nowMs - 5 * 60 * 1000);
    const oneHourAgo = new Date(nowMs - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(nowMs - 24 * 60 * 60 * 1000);

    const [callsPast5Minutes, callsPastHour, callsPast24Hours, lastCallAt, rateLimit] =
        await Promise.all([
            countApiCallsSince({
                accountId: params.accountId,
                threshold: fiveMinutesAgo,
            }),
            countApiCallsSince({
                accountId: params.accountId,
                threshold: oneHourAgo,
            }),
            countApiCallsSince({
                accountId: params.accountId,
                threshold: twentyFourHoursAgo,
            }),
            getLastApiCallTimestamp({
                accountId: params.accountId,
            }),
            getEtsyRateLimitRuntimeSnapshot(),
        ]);

    return {
        rateLimit,
        stats: {
            callsPast5Minutes,
            callsPast24Hours,
            callsPastHour,
            lastCallAt,
        },
    };
};
