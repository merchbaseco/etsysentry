import { z } from 'zod';
import {
    enqueueTrackedListingSyncJobs
} from '../../../services/listings/enqueue-tracked-listing-sync-jobs';
import { createEventLog } from '../../../services/logs/create-event-log';
import { appProcedure } from '../../trpc';

const refreshManyInputSchema = z.object({
    trackedListingIds: z.array(z.string().uuid()).min(1).max(100)
});

export const listingsRefreshManyProcedure = appProcedure
    .input(refreshManyInputSchema)
    .mutation(async ({ ctx, input }) => {
        const trackedListingIds = Array.from(new Set(input.trackedListingIds));
        const result = await enqueueTrackedListingSyncJobs({
            selection: {
                mode: 'selected',
                trackedListingIds
            },
            accountId: ctx.accountId
        });
        const { enqueuedCount, skippedCount, totalCount } = result;

        const status =
            totalCount === 0
                ? 'success'
                : skippedCount === 0
                  ? 'pending'
                  : enqueuedCount === 0
                    ? 'failed'
                    : 'partial';
        const level = status === 'failed' ? 'error' : status === 'partial' ? 'warn' : 'info';
        const message =
            totalCount === 0
                ? 'No selected tracked listings were found to queue for sync.'
                : skippedCount === 0
                  ? `Queued listing sync for ${enqueuedCount} selected tracked listings.`
                  : `Queued listing sync for ${enqueuedCount} of ${totalCount}` +
                    ' selected tracked listings.';

        await createEventLog({
            action: 'listing.bulk_sync_queued',
            category: 'listing',
            clerkUserId: ctx.user.sub,
            detailsJson: {
                enqueuedCount,
                requestedCount: trackedListingIds.length,
                skippedCount,
                totalCount
            },
            level,
            message,
            primitiveType: 'system',
            requestId: ctx.requestId,
            status,
            accountId: ctx.accountId
        });

        return {
            enqueuedCount,
            skippedCount,
            totalCount
        };
    });
