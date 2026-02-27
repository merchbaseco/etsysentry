import { z } from 'zod';
import { enqueueTrackedListingSyncJobs } from '../../../services/listings/enqueue-tracked-listing-sync-jobs';
import { createEventLog } from '../../../services/logs/create-event-log';
import { appProcedure } from '../../trpc';

const refreshManyInputSchema = z.object({
    trackedListingIds: z.array(z.string().uuid()).min(1).max(100),
});

export const listingsRefreshManyProcedure = appProcedure
    .input(refreshManyInputSchema)
    .mutation(async ({ ctx, input }) => {
        const trackedListingIds = Array.from(new Set(input.trackedListingIds));
        const result = await enqueueTrackedListingSyncJobs({
            selection: {
                mode: 'selected',
                trackedListingIds,
            },
            accountId: ctx.accountId,
        });
        const { enqueuedCount, skippedCount, totalCount } = result;

        let status: 'failed' | 'partial' | 'pending' | 'success';
        if (totalCount === 0) {
            status = 'success';
        } else if (skippedCount === 0) {
            status = 'pending';
        } else if (enqueuedCount === 0) {
            status = 'failed';
        } else {
            status = 'partial';
        }

        let level: 'error' | 'info' | 'warn' = 'info';
        if (status === 'failed') {
            level = 'error';
        } else if (status === 'partial') {
            level = 'warn';
        }

        let message = 'No selected tracked listings were found to queue for sync.';
        if (totalCount !== 0) {
            if (skippedCount === 0) {
                message = `Queued listing sync for ${enqueuedCount} selected tracked listings.`;
            } else {
                message =
                    `Queued listing sync for ${enqueuedCount} of ${totalCount}` +
                    ' selected tracked listings.';
            }
        }

        await createEventLog({
            action: 'listing.bulk_sync_queued',
            category: 'listing',
            clerkUserId: ctx.user.sub,
            detailsJson: {
                enqueuedCount,
                requestedCount: trackedListingIds.length,
                skippedCount,
                totalCount,
            },
            level,
            message,
            primitiveType: 'system',
            requestId: ctx.requestId,
            status,
            accountId: ctx.accountId,
        });

        return {
            enqueuedCount,
            skippedCount,
            totalCount,
        };
    });
