import { z } from 'zod';

export const SYNC_STALE_KEYWORDS_CRON = '* * * * *';
export const SYNC_STALE_KEYWORDS_BATCH_SIZE = 100;
export const SYNC_KEYWORD_JOB_NAME = 'sync-keyword';
export const SYNC_STALE_KEYWORDS_JOB_NAME = 'sync-stale-keywords';

export const syncKeywordJobInputSchema = z.object({
    clerkUserId: z.string().min(1),
    tenantId: z.string().min(1),
    trackedKeywordId: z.string().uuid()
});

export const syncStaleKeywordsJobInputSchema = z.record(z.string(), z.unknown());

export type SyncKeywordJobInput = z.infer<typeof syncKeywordJobInputSchema>;
