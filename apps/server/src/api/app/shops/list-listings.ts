import { z } from 'zod';
import { decorateTrackedListingsWithUsd } from '../../../services/currency/decorate-tracked-listings-with-usd';
import {
    listShopActivityListings,
    shopActivitySortOrders,
} from '../../../services/shops/list-shop-activity-listings';
import { appProcedure } from '../../trpc';

const listShopListingsInputSchema = z.object({
    etsyShopId: z.string().trim().min(1),
    sortOrder: z.enum(shopActivitySortOrders).default('most_recently_sold'),
});

export const shopsListListingsProcedure = appProcedure
    .input(listShopListingsInputSchema)
    .query(async ({ ctx, input }) => {
        const response = await listShopActivityListings({
            accountId: ctx.accountId,
            etsyShopId: input.etsyShopId,
            sortOrder: input.sortOrder,
        });

        return {
            ...response,
            items: await decorateTrackedListingsWithUsd(response.items),
        };
    });
