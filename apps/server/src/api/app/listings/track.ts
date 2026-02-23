import { z } from 'zod';
import { trackListing } from '../../../services/listings/tracked-listings-service';
import { appProcedure } from '../../trpc';

export const listingsTrackProcedure = appProcedure
    .input(
        z.object({
            listing: z.string().min(1)
        })
    )
    .mutation(async ({ ctx, input }) => {
        return trackListing({
            listingInput: input.listing,
            requestId: ctx.requestId,
            tenantId: ctx.tenantId,
            trackerClerkUserId: ctx.user.sub
        });
    });
