import { z } from 'zod';
import { refreshTrackedListing } from '../../../services/listings/tracked-listings-service';
import { appProcedure } from '../../trpc';

export const listingsRefreshProcedure = appProcedure
    .input(
        z.object({
            oauthSessionId: z.string().min(1),
            tenantId: z.string().min(1),
            trackedListingId: z.string().uuid(),
            trackerClerkUserId: z.string().min(1)
        })
    )
    .mutation(async ({ input }) => {
        return refreshTrackedListing({
            oauthSessionId: input.oauthSessionId,
            tenantId: input.tenantId,
            trackedListingId: input.trackedListingId,
            trackerClerkUserId: input.trackerClerkUserId
        });
    });
