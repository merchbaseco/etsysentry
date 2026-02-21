import { z } from 'zod';
import { trackListing } from '../../../services/listings/tracked-listings-service';
import { appProcedure } from '../../trpc';

export const listingsTrackProcedure = appProcedure
    .input(
        z.object({
            listing: z.string().min(1),
            oauthSessionId: z.string().min(1),
            tenantId: z.string().min(1),
            trackerClerkUserId: z.string().min(1)
        })
    )
    .mutation(async ({ input }) => {
        return trackListing({
            listingInput: input.listing,
            oauthSessionId: input.oauthSessionId,
            tenantId: input.tenantId,
            trackerClerkUserId: input.trackerClerkUserId
        });
    });
