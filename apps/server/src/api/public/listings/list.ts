import { decorateTrackedListingsWithUsd } from '../../../services/currency/decorate-tracked-listings-with-usd';
import { listTrackedListings } from '../../../services/listings/tracked-listings-service';
import { publicProcedure } from '../../trpc';
import { filterPublicListingItems, publicListingsListInputSchema } from '../list-filters';

export const publicListingsListProcedure = publicProcedure
    .input(publicListingsListInputSchema)
    .query(async ({ ctx, input }) => {
        const response = await listTrackedListings({
            accountId: ctx.accountId,
        });
        const filteredItems = filterPublicListingItems(response.items, input);

        return {
            items: await decorateTrackedListingsWithUsd(filteredItems),
        };
    });
