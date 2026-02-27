import { z } from 'zod';
import { getDashboardSummary } from '../../../services/dashboard/get-dashboard-summary';
import { appProcedure } from '../../trpc';

export const dashboardGetSummaryProcedure = appProcedure.input(z.object({})).query(({ ctx }) => {
    return getDashboardSummary({
        clerkUserId: ctx.user.sub,
        accountId: ctx.accountId,
    });
});
