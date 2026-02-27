import { router } from '../../trpc';
import { listingsGetKeywordRanksForProductProcedure } from './get-keyword-ranks-for-product';
import { listingsGetMetricHistoryProcedure } from './get-metric-history';
import { listingsListProcedure } from './list';
import { listingsRefreshProcedure } from './refresh';
import { listingsRefreshManyProcedure } from './refresh-many';
import { listingsTrackProcedure } from './track';

export const listingsRouter = router({
    getMetricHistory: listingsGetMetricHistoryProcedure,
    getKeywordRanksForProduct: listingsGetKeywordRanksForProductProcedure,
    list: listingsListProcedure,
    refreshMany: listingsRefreshManyProcedure,
    refresh: listingsRefreshProcedure,
    track: listingsTrackProcedure,
});
