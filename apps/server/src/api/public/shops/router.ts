import { router } from '../../trpc';
import { publicShopsListProcedure } from './list';
import { publicShopsListingsRouter } from './listings/router';
import { publicShopsOverviewRouter } from './overview/router';
import { publicShopsTrackProcedure } from './track';

export const publicShopsRouter = router({
    list: publicShopsListProcedure,
    listings: publicShopsListingsRouter,
    overview: publicShopsOverviewRouter,
    track: publicShopsTrackProcedure,
});
