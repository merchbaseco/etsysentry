import { z } from 'zod';
import { listTrackedListings } from '../../../services/listings/tracked-listings-service';
import { appProcedure } from '../../trpc';

export const listingsListProcedure = appProcedure
    .input(
        z.object({
            tenantId: z.string().min(1),
            trackerClerkUserId: z.string().min(1).optional()
        })
    )
    .query(async ({ input }) => {
        return listTrackedListings({
            tenantId: input.tenantId,
            trackerClerkUserId: input.trackerClerkUserId
        });
    });
