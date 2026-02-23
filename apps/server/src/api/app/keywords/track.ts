import { z } from 'zod';
import { enqueueKeywordSyncJob } from '../../../jobs/sync-keyword-jobs';
import { trackKeyword } from '../../../services/keywords/tracked-keywords-service';
import { createEventLog } from '../../../services/logs/create-event-log';
import { appProcedure } from '../../trpc';

export const keywordsTrackProcedure = appProcedure
    .input(
        z.object({
            keyword: z.string().min(1)
        })
    )
    .mutation(async ({ ctx, input }) => {
        const trackedKeyword = await trackKeyword({
            keywordInput: input.keyword,
            requestId: ctx.requestId,
            tenantId: ctx.tenantId,
            trackerClerkUserId: ctx.user.sub
        });

        const monitorRunId = await enqueueKeywordSyncJob({
            clerkUserId: trackedKeyword.item.trackerClerkUserId,
            tenantId: trackedKeyword.item.tenantId,
            trackedKeywordId: trackedKeyword.item.id
        });

        await createEventLog({
            action: 'keyword.sync_queued',
            category: 'keyword',
            clerkUserId: ctx.user.sub,
            detailsJson: {
                keyword: trackedKeyword.item.keyword
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
            tenantId: trackedKeyword.item.tenantId
        });

        return trackedKeyword;
    });
