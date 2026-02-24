import { z } from 'zod';
import { getListingMetricHistory } from '../../../services/listings/get-listing-metric-history';
import { appProcedure } from '../../trpc';

export const listingsGetMetricHistoryProcedure = appProcedure
    .input(
        z.object({
            trackedListingId: z.string().uuid(),
            days: z.coerce.number().int().min(1).max(365).optional()
        })
    )
    .query(async ({ ctx, input }) => {
        return getListingMetricHistory({
            accountId: ctx.accountId,
            trackedListingId: input.trackedListingId,
            days: input.days
        });
    });
