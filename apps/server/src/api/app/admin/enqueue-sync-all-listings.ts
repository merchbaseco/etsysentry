import { z } from 'zod';
import {
    enqueueTrackedListingSyncJobs
} from '../../../services/listings/enqueue-tracked-listing-sync-jobs';
import { createEventLog } from '../../../services/logs/create-event-log';
import { adminProcedure } from '../../trpc';

export const adminEnqueueSyncAllListingsProcedure = adminProcedure
    .input(z.object({}))
    .mutation(async ({ ctx }) => {
        const result = await enqueueTrackedListingSyncJobs({
            selection: {
                mode: 'all'
            },
            tenantId: ctx.tenantId
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

        const level =
            status === 'failed' ? 'error' : status === 'partial' ? 'warn' : 'info';

        const message =
            totalCount === 0
                ? 'No tracked listings found to queue for sync.'
                : skippedCount === 0
                  ? `Queued listing sync for ${enqueuedCount} tracked listings.`
                  : `Queued listing sync for ${enqueuedCount} of ${totalCount} tracked listings.`;

        await createEventLog({
            action: 'listing.bulk_sync_queued',
            category: 'listing',
            clerkUserId: ctx.user.sub,
            detailsJson: {
                enqueuedCount,
                skippedCount,
                totalCount
            },
            level,
            message,
            primitiveType: 'system',
            requestId: ctx.requestId,
            status,
            tenantId: ctx.tenantId
        });

        return {
            enqueuedCount,
            skippedCount,
            totalCount
        };
    });
