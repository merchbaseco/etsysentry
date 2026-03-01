import { z } from 'zod';
import { enqueueKeywordSyncJob } from '../../../jobs/run-server-jobs';
import { setTrackedKeywordSyncStateByKeywordId } from '../../../services/keywords/set-tracked-keyword-sync-state';
import { trackKeyword } from '../../../services/keywords/tracked-keywords-service';
import { createEventLog } from '../../../services/logs/create-event-log';
import { appProcedure } from '../../trpc';

export const keywordsTrackProcedure = appProcedure
    .input(
        z.object({
            keyword: z.string().min(1),
        })
    )
    .mutation(async ({ ctx, input }) => {
        const trackedKeyword = await trackKeyword({
            keywordInput: input.keyword,
            requestId: ctx.requestId,
            accountId: ctx.accountId,
            trackerClerkUserId: ctx.user.sub,
        });

        const monitorRunId = await enqueueKeywordSyncJob({
            clerkUserId: trackedKeyword.item.trackerClerkUserId,
            accountId: trackedKeyword.item.accountId,
            trackedKeywordId: trackedKeyword.item.id,
        });

        if (monitorRunId) {
            await setTrackedKeywordSyncStateByKeywordId({
                accountId: trackedKeyword.item.accountId,
                trackedKeywordId: trackedKeyword.item.id,
                syncState: 'queued',
            });
        }

        await createEventLog({
            action: 'keyword.sync_queued',
            category: 'keyword',
            clerkUserId: ctx.user.sub,
            detailsJson: {
                keyword: trackedKeyword.item.keyword,
            },
            keyword: trackedKeyword.item.keyword,
            level: monitorRunId ? 'info' : 'warn',
            message: monitorRunId
                ? `Queued keyword sync for "${trackedKeyword.item.keyword}".`
                : `Keyword sync queue was unavailable for "${trackedKeyword.item.keyword}".`,
            monitorRunId,
            primitiveId: trackedKeyword.item.id,
            primitiveType: 'keyword',
            requestId: ctx.requestId,
            status: monitorRunId ? 'pending' : 'failed',
            accountId: trackedKeyword.item.accountId,
        });

        return {
            ...trackedKeyword,
            item: {
                ...trackedKeyword.item,
                syncState: monitorRunId ? 'queued' : trackedKeyword.item.syncState,
            },
        };
    });
