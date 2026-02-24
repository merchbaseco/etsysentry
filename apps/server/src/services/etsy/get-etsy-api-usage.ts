import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../db';
import { etsyApiCallEvents } from '../../db/schema';
import {
    getEtsyRateLimitRuntimeSnapshot,
    type EtsyRateLimitRuntimeSnapshot
} from './etsy-rate-limit-runtime';

export type EtsyApiUsageStats = {
    callsPast5Minutes: number;
    callsPast24Hours: number;
    callsPastHour: number;
    lastCallAt: Date | null;
};

export type EtsyApiUsage = {
    rateLimit: EtsyRateLimitRuntimeSnapshot;
    stats: EtsyApiUsageStats;
};

const countApiCallsSince = async (params: {
    tenantId: string;
    threshold: Date;
}): Promise<number> => {
    const [row] = await db
        .select({
            value: sql<number>`count(*)::int`
        })
        .from(etsyApiCallEvents)
        .where(
            and(
                eq(etsyApiCallEvents.tenantId, params.tenantId),
                gte(etsyApiCallEvents.createdAt, params.threshold)
            )
        );

    return row?.value ?? 0;
};

const getLastApiCallTimestamp = async (params: { tenantId: string }): Promise<Date | null> => {
    const [row] = await db
        .select({
            value: sql<Date | null>`max(${etsyApiCallEvents.createdAt})`
        })
        .from(etsyApiCallEvents)
        .where(eq(etsyApiCallEvents.tenantId, params.tenantId));

    return row?.value ?? null;
};

export const getEtsyApiUsage = async (params: { tenantId: string }): Promise<EtsyApiUsage> => {
    const nowMs = Date.now();
    const fiveMinutesAgo = new Date(nowMs - 5 * 60 * 1000);
    const oneHourAgo = new Date(nowMs - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(nowMs - 24 * 60 * 60 * 1000);

    const [callsPast5Minutes, callsPastHour, callsPast24Hours, lastCallAt, rateLimit] =
        await Promise.all([
            countApiCallsSince({
                tenantId: params.tenantId,
                threshold: fiveMinutesAgo
            }),
            countApiCallsSince({
                tenantId: params.tenantId,
                threshold: oneHourAgo
            }),
            countApiCallsSince({
                tenantId: params.tenantId,
                threshold: twentyFourHoursAgo
            }),
            getLastApiCallTimestamp({
                tenantId: params.tenantId
            }),
            getEtsyRateLimitRuntimeSnapshot()
        ]);

    return {
        rateLimit,
        stats: {
            callsPast5Minutes,
            callsPast24Hours,
            callsPastHour,
            lastCallAt
        }
    };
};
