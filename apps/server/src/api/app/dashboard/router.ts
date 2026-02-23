import { router } from '../../trpc';
import { dashboardGetSummaryProcedure } from './get-summary';

export const dashboardRouter = router({
    getSummary: dashboardGetSummaryProcedure
});
