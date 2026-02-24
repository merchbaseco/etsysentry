import { router } from '../../trpc';
import { listingsGetKeywordRanksForProductProcedure } from './get-keyword-ranks-for-product';
import { listingsListProcedure } from './list';
import { listingsRefreshManyProcedure } from './refresh-many';
import { listingsRefreshProcedure } from './refresh';
import { listingsTrackProcedure } from './track';

export const listingsRouter = router({
    getKeywordRanksForProduct: listingsGetKeywordRanksForProductProcedure,
    list: listingsListProcedure,
    refreshMany: listingsRefreshManyProcedure,
    refresh: listingsRefreshProcedure,
    track: listingsTrackProcedure
});
