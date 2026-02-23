import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { trackedKeywords } from '../../db/schema';

export type TrackedKeywordRecord = {
    id: string;
    keyword: string;
    lastRefreshError: string | null;
    lastRefreshedAt: string;
    nextSyncAt: string;
    normalizedKeyword: string;
    tenantId: string;
    trackerClerkUserId: string;
    trackingState: (typeof trackedKeywords.$inferSelect)['trackingState'];
    updatedAt: string;
};

export const normalizeTrackedKeywordInput = (
    rawInput: string
): {
    keyword: string;
    normalizedKeyword: string;
} | null => {
    const trimmed = rawInput.trim();

    if (trimmed.length === 0) {
        return null;
    }

    const collapsed = trimmed.replace(/\s+/g, ' ');

    return {
        keyword: collapsed,
        normalizedKeyword: collapsed.toLowerCase()
    };
};

const toRecord = (row: typeof trackedKeywords.$inferSelect): TrackedKeywordRecord => {
    return {
        id: row.id,
        keyword: row.keyword,
        lastRefreshError: row.lastRefreshError,
        lastRefreshedAt: row.lastRefreshedAt.toISOString(),
        nextSyncAt: row.nextSyncAt.toISOString(),
        normalizedKeyword: row.normalizedKeyword,
        tenantId: row.tenantId,
        trackerClerkUserId: row.trackerClerkUserId,
        trackingState: row.trackingState,
        updatedAt: row.updatedAt.toISOString()
    };
};

export const listTrackedKeywords = async (params: {
    tenantId: string;
    trackerClerkUserId?: string;
}): Promise<{ items: TrackedKeywordRecord[] }> => {
    const whereClause = params.trackerClerkUserId
        ? and(
              eq(trackedKeywords.tenantId, params.tenantId),
              eq(trackedKeywords.trackerClerkUserId, params.trackerClerkUserId)
          )
        : eq(trackedKeywords.tenantId, params.tenantId);

    const rows = await db
        .select()
        .from(trackedKeywords)
        .where(whereClause)
        .orderBy(desc(trackedKeywords.updatedAt));

    return {
        items: rows.map(toRecord)
    };
};

export const trackKeyword = async (params: {
    keywordInput: string;
    tenantId: string;
    trackerClerkUserId: string;
}): Promise<{
    created: boolean;
    item: TrackedKeywordRecord;
}> => {
    const normalized = normalizeTrackedKeywordInput(params.keywordInput);

    if (!normalized) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Keyword must not be empty.'
        });
    }

    const existing = await db
        .select({
            id: trackedKeywords.id
        })
        .from(trackedKeywords)
        .where(
            and(
                eq(trackedKeywords.tenantId, params.tenantId),
                eq(trackedKeywords.normalizedKeyword, normalized.normalizedKeyword)
            )
        )
        .limit(1);

    const now = new Date();
    const upsertValues = {
        keyword: normalized.keyword,
        lastRefreshError: null,
        lastRefreshedAt: now,
        nextSyncAt: now,
        normalizedKeyword: normalized.normalizedKeyword,
        tenantId: params.tenantId,
        trackerClerkUserId: params.trackerClerkUserId,
        trackingState: 'active' as const,
        updatedAt: now
    };

    const [row] = await db
        .insert(trackedKeywords)
        .values(upsertValues)
        .onConflictDoUpdate({
            set: upsertValues,
            target: [trackedKeywords.tenantId, trackedKeywords.normalizedKeyword]
        })
        .returning();

    return {
        created: existing.length === 0,
        item: toRecord(row)
    };
};
