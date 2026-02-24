import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { trackedKeywords } from '../../db/schema';
import { createEventLog } from '../logs/create-event-log';

export type TrackedKeywordRecord = {
    id: string;
    keyword: string;
    lastRefreshError: string | null;
    lastRefreshedAt: string;
    nextSyncAt: string;
    normalizedKeyword: string;
    accountId: string;
    trackerClerkUserId: string;
    syncState: (typeof trackedKeywords.$inferSelect)['syncState'];
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
        accountId: row.accountId,
        trackerClerkUserId: row.trackerClerkUserId,
        syncState: row.syncState,
        trackingState: row.trackingState,
        updatedAt: row.updatedAt.toISOString()
    };
};

export const listTrackedKeywords = async (params: {
    accountId: string;
    trackerClerkUserId?: string;
}): Promise<{ items: TrackedKeywordRecord[] }> => {
    const whereClause = params.trackerClerkUserId
        ? and(
              eq(trackedKeywords.accountId, params.accountId),
              eq(trackedKeywords.trackerClerkUserId, params.trackerClerkUserId)
          )
        : eq(trackedKeywords.accountId, params.accountId);

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
    requestId?: string;
    accountId: string;
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
                eq(trackedKeywords.accountId, params.accountId),
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
        accountId: params.accountId,
        trackerClerkUserId: params.trackerClerkUserId,
        trackingState: 'active' as const,
        updatedAt: now
    };

    const [row] = await db
        .insert(trackedKeywords)
        .values(upsertValues)
        .onConflictDoUpdate({
            set: upsertValues,
            target: [trackedKeywords.accountId, trackedKeywords.normalizedKeyword]
        })
        .returning();

    const created = existing.length === 0;
    const item = toRecord(row);

    await createEventLog({
        action: created ? 'keyword.tracked' : 'keyword.updated',
        category: 'keyword',
        clerkUserId: params.trackerClerkUserId,
        detailsJson: {
            normalizedKeyword: item.normalizedKeyword
        },
        keyword: item.keyword,
        level: 'info',
        message: created
            ? `Started tracking keyword "${item.keyword}".`
            : `Updated tracked keyword "${item.keyword}".`,
        primitiveId: item.id,
        primitiveType: 'keyword',
        requestId: params.requestId ?? null,
        status: 'success',
        accountId: item.accountId
    });

    return {
        created,
        item
    };
};
