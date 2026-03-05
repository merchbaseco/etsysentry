import { z } from 'zod';
import { decorateTrackedListingsWithUsd } from '../../../services/currency/decorate-tracked-listings-with-usd';
import {
    listShopActivityListings,
    shopActivitySortOrders,
} from '../../../services/shops/list-shop-activity-listings';
import { publicProcedure } from '../../trpc';
import { filterPublicShopListingItems, publicShopListingsFilterInputSchema } from '../list-filters';

const publicShopsListListingsInputSchema = publicShopListingsFilterInputSchema.extend({
    etsyShopId: z.string().trim().min(1),
    sortOrder: z.enum(shopActivitySortOrders).default('most_recently_sold'),
});

export const publicShopsListListingsProcedure = publicProcedure
    .input(publicShopsListListingsInputSchema)
    .query(async ({ ctx, input }) => {
        const response = await listShopActivityListings({
            accountId: ctx.accountId,
            etsyShopId: input.etsyShopId,
            sortOrder: input.sortOrder,
        });
        const filteredItems = filterPublicShopListingItems(response.items, input);

        return {
            ...response,
            items: await decorateTrackedListingsWithUsd(filteredItems),
        };
    });
