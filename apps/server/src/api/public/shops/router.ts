import { router } from '../../trpc';
import { publicShopsGetOverviewProcedure } from './get-overview';
import { publicShopsListProcedure } from './list';
import { publicShopsListListingsProcedure } from './list-listings';
import { publicShopsTrackProcedure } from './track';

export const publicShopsRouter = router({
    getOverview: publicShopsGetOverviewProcedure,
    list: publicShopsListProcedure,
    listListings: publicShopsListListingsProcedure,
    track: publicShopsTrackProcedure,
});
