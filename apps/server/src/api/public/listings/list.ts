import { z } from 'zod';
import { decorateTrackedListingsWithUsd } from '../../../services/currency/decorate-tracked-listings-with-usd';
import { listTrackedListings } from '../../../services/listings/tracked-listings-service';
import { publicProcedure } from '../../trpc';

export const publicListingsListProcedure = publicProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
        const response = await listTrackedListings({
            accountId: ctx.accountId,
        });

        return {
            items: await decorateTrackedListingsWithUsd(response.items),
        };
    });
