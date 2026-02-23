import { z } from 'zod';
import { refreshTrackedListing } from '../../../services/listings/tracked-listings-service';
import { appProcedure } from '../../trpc';

export const listingsRefreshProcedure = appProcedure
    .input(
        z.object({
            trackedListingId: z.string().uuid()
        })
    )
    .mutation(async ({ ctx, input }) => {
        return refreshTrackedListing({
            clerkUserId: ctx.user.sub,
            requestId: ctx.requestId,
            tenantId: ctx.tenantId,
            trackedListingId: input.trackedListingId,
            trackerClerkUserId: ctx.user.sub
        });
    });
