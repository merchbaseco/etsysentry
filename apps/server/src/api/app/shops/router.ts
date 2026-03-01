import { router } from '../../trpc';
import { shopsGetOverviewProcedure } from './get-overview';
import { shopsListProcedure } from './list';
import { shopsListListingsProcedure } from './list-listings';
import { shopsRefreshProcedure } from './refresh';
import { shopsTrackProcedure } from './track';

export const shopsRouter = router({
    getOverview: shopsGetOverviewProcedure,
    list: shopsListProcedure,
    listListings: shopsListListingsProcedure,
    refresh: shopsRefreshProcedure,
    track: shopsTrackProcedure,
});
