import { z } from 'zod';

export const SYNC_LISTING_JOB_NAME = 'sync-listing';

export const syncListingJobInputSchema = z.object({
    clerkUserId: z.string().min(1),
    etsyListingId: z.string().min(1),
    accountId: z.string().min(1)
});

export type SyncListingJobInput = z.infer<typeof syncListingJobInputSchema>;
