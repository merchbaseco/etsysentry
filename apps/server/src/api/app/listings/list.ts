import { z } from 'zod';
import { listTrackedListings } from '../../../services/listings/tracked-listings-service';
import { appProcedure } from '../../trpc';

export const listingsListProcedure = appProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
        return listTrackedListings({
            tenantId: ctx.tenantId,
            trackerClerkUserId: ctx.user.sub
        });
    });
