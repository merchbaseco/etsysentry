import { and, asc, lte, ne } from 'drizzle-orm';
import { db } from '../../db';
import { trackedKeywords } from '../../db/schema';
import {
    SYNC_STALE_KEYWORDS_BATCH_SIZE,
    syncKeywordJobInputSchema,
    type SyncKeywordJobInput
} from '../../jobs/sync-keyword-shared';

export const findStaleKeywords = async (params?: {
    now?: Date;
}): Promise<SyncKeywordJobInput[]> => {
    const now = params?.now ?? new Date();

    const rows = await db
        .select({
            clerkUserId: trackedKeywords.trackerClerkUserId,
            tenantId: trackedKeywords.tenantId,
            trackedKeywordId: trackedKeywords.id
        })
        .from(trackedKeywords)
        .where(
            and(
                ne(trackedKeywords.trackingState, 'paused'),
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
