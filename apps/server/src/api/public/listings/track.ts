import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { findLatestClerkUserIdByAccountId } from '../../../services/auth/find-latest-clerk-user-id-by-account-id';
import { decorateTrackedListingWithUsd } from '../../../services/currency/decorate-tracked-listings-with-usd';
import { trackListing } from '../../../services/listings/tracked-listings-service';
import { publicProcedure } from '../../trpc';

export const publicListingsTrackProcedure = publicProcedure
    .input(
        z.object({
            listing: z.string().min(1),
        })
    )
    .mutation(async ({ ctx, input }) => {
        const clerkUserId = await findLatestClerkUserIdByAccountId({
            accountId: ctx.accountId,
        });

        if (!clerkUserId) {
            throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: 'No Clerk identity is linked to this account.',
            });
        }

        const response = await trackListing({
            listingInput: input.listing,
            requestId: ctx.requestId,
            accountId: ctx.accountId,
            trackerClerkUserId: clerkUserId,
        });

        return {
            created: response.created,
            item: await decorateTrackedListingWithUsd(response.item),
        };
    });
