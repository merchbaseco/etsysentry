import { router } from '../../trpc';
import { listingsListProcedure } from './list';
import { listingsRefreshProcedure } from './refresh';
import { listingsTrackProcedure } from './track';

export const listingsRouter = router({
    list: listingsListProcedure,
    refresh: listingsRefreshProcedure,
    track: listingsTrackProcedure
});
