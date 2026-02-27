import { z } from 'zod';
import { enqueueTrackedListingSyncJobs } from '../../../services/listings/enqueue-tracked-listing-sync-jobs';
import { createEventLog } from '../../../services/logs/create-event-log';
import { adminProcedure } from '../../trpc';

export const adminEnqueueSyncAllListingsProcedure = adminProcedure
    .input(z.object({}))
    .mutation(async ({ ctx }) => {
        const result = await enqueueTrackedListingSyncJobs({
            selection: {
                mode: 'all',
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

        let message = 'No tracked listings found to queue for sync.';
        if (totalCount !== 0) {
            if (skippedCount === 0) {
                message = `Queued listing sync for ${enqueuedCount} tracked listings.`;
            } else {
                message = `Queued listing sync for ${enqueuedCount} of ${totalCount} tracked listings.`;
            }
        }

        await createEventLog({
            action: 'listing.bulk_sync_queued',
            category: 'listing',
            clerkUserId: ctx.user.sub,
            detailsJson: {
                enqueuedCount,
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
