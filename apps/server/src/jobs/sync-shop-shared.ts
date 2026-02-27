import { z } from 'zod';

export const SYNC_STALE_SHOPS_CRON = '* * * * *';
export const SYNC_STALE_SHOPS_BATCH_SIZE = 100;
export const SYNC_SHOP_JOB_NAME = 'sync-shop';
export const SYNC_STALE_SHOPS_JOB_NAME = 'sync-stale-shops';

export const syncShopJobInputSchema = z.object({
    clerkUserId: z.string().min(1),
    accountId: z.string().min(1),
    trackedShopId: z.string().uuid(),
});

export const syncStaleShopsJobInputSchema = z.record(z.string(), z.unknown());

export type SyncShopJobInput = z.infer<typeof syncShopJobInputSchema>;
