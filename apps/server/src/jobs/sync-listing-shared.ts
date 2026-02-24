import { z } from 'zod';

export const SYNC_STALE_LISTINGS_CRON = '* * * * *';
export const SYNC_STALE_LISTINGS_BATCH_SIZE = 100;
export const SYNC_LISTING_JOB_NAME = 'sync-listing';
export const SYNC_STALE_LISTINGS_JOB_NAME = 'sync-stale-listings';

export const syncListingJobInputSchema = z.object({
    clerkUserId: z.string().min(1),
    etsyListingId: z.string().min(1),
    accountId: z.string().min(1)
});

export const syncStaleListingsJobInputSchema = z.record(z.string(), z.unknown());

export type SyncListingJobInput = z.infer<typeof syncListingJobInputSchema>;
