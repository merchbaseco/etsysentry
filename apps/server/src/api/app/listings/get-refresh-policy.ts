import { z } from 'zod';
import {
    getListingRefreshPolicySummary
} from '../../../services/listings/get-listing-refresh-policy';
import { appProcedure } from '../../trpc';

export const listingsGetRefreshPolicyProcedure = appProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
        return getListingRefreshPolicySummary({
            accountId: ctx.accountId
        });
    });
