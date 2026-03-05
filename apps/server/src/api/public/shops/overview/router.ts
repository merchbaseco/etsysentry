import { router } from '../../../trpc';
import { publicShopsOverviewGetProcedure } from './get';

export const publicShopsOverviewRouter = router({
    get: publicShopsOverviewGetProcedure,
});
