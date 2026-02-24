import { z } from 'zod';
import { decorateTrackedListingWithUsd } from '../../../services/currency/decorate-tracked-listings-with-usd';
import { trackListing } from '../../../services/listings/tracked-listings-service';
import { appProcedure } from '../../trpc';

export const listingsTrackProcedure = appProcedure
    .input(
        z.object({
            listing: z.string().min(1)
        })
    )
    .mutation(async ({ ctx, input }) => {
        const response = await trackListing({
            listingInput: input.listing,
            requestId: ctx.requestId,
            accountId: ctx.accountId,
            trackerClerkUserId: ctx.user.sub
        });

        return {
            created: response.created,
            item: await decorateTrackedListingWithUsd(response.item)
        };
    });
