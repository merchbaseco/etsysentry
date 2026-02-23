import { z } from 'zod';
import { decorateTrackedListingsWithUsd } from '../../../services/currency/decorate-tracked-listings-with-usd';
import { listTrackedListings } from '../../../services/listings/tracked-listings-service';
import { appProcedure } from '../../trpc';

export const listingsListProcedure = appProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
        const response = await listTrackedListings({
            tenantId: ctx.tenantId,
            trackerClerkUserId: ctx.user.sub
        });

        return {
            items: await decorateTrackedListingsWithUsd(response.items)
        };
    });
