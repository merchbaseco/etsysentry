import { router } from '../../trpc';
import { adminEnqueueSyncAllListingsProcedure } from './enqueue-sync-all-listings';
import { adminGetEtsyApiUsageProcedure } from './get-etsy-api-usage';
import { adminStatusProcedure } from './status';

export const adminRouter = router({
    enqueueSyncAllListings: adminEnqueueSyncAllListingsProcedure,
    getEtsyApiUsage: adminGetEtsyApiUsageProcedure,
    status: adminStatusProcedure
});
