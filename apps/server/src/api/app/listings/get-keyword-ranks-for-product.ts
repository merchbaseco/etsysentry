import { z } from 'zod';
import { getKeywordRanksForProduct } from '../../../services/keywords/keyword-rankings-service';
import { appProcedure } from '../../trpc';

export const listingsGetKeywordRanksForProductProcedure = appProcedure
    .input(
        z.object({
            listing: z.string().min(1)
        })
    )
    .query(async ({ ctx, input }) => {
        return getKeywordRanksForProduct({
            listingInput: input.listing,
            accountId: ctx.accountId
        });
    });
