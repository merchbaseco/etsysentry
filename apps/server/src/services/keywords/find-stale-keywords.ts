import { and, asc, eq, isNotNull, lte, ne } from 'drizzle-orm';
import { db } from '../../db';
import { accounts, trackedKeywords } from '../../db/schema';
import {
    SYNC_STALE_KEYWORDS_BATCH_SIZE,
    type SyncKeywordJobInput,
    syncKeywordJobInputSchema,
} from '../../jobs/sync-keyword-shared';

export const findStaleKeywords = async (params?: {
    now?: Date;
}): Promise<SyncKeywordJobInput[]> => {
    const now = params?.now ?? new Date();

    const rows = await db
        .select({
            clerkUserId: accounts.merchbaseUserId,
            accountId: trackedKeywords.accountId,
            trackedKeywordId: trackedKeywords.id,
        })
        .from(trackedKeywords)
        .innerJoin(accounts, eq(accounts.id, trackedKeywords.accountId))
        .where(
            and(
                isNotNull(accounts.merchbaseUserId),
                ne(trackedKeywords.trackingState, 'paused'),
                eq(trackedKeywords.syncState, 'idle'),
                lte(trackedKeywords.nextSyncAt, now)
            )
        )
        .orderBy(asc(trackedKeywords.nextSyncAt))
        .limit(SYNC_STALE_KEYWORDS_BATCH_SIZE);

    const items: SyncKeywordJobInput[] = [];

    for (const row of rows) {
        const parsedInput = syncKeywordJobInputSchema.safeParse(row);
        if (!parsedInput.success) {
            continue;
        }

        items.push(parsedInput.data);
    }

    return items;
};
