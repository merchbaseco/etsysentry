import { z } from 'zod';
import { decorateTrackedListingWithUsd } from '../../../services/currency/decorate-tracked-listings-with-usd';
import { refreshTrackedListing } from '../../../services/listings/tracked-listings-service';
import { appProcedure } from '../../trpc';

export const listingsRefreshProcedure = appProcedure
    .input(
        z.object({
            trackedListingId: z.string().uuid()
        })
    )
    .mutation(async ({ ctx, input }) => {
        const item = await refreshTrackedListing({
            clerkUserId: ctx.user.sub,
            requestId: ctx.requestId,
            accountId: ctx.accountId,
            trackedListingId: input.trackedListingId,
            trackerClerkUserId: ctx.user.sub
        });

        return decorateTrackedListingWithUsd(item);
    });
