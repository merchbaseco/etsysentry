import { router } from '../../trpc';
import { keywordsGetActivityProcedure } from './get-activity';
import { keywordsGetDailyProductRanksForKeywordProcedure } from './get-daily-product-ranks-for-keyword';
import { keywordsListProcedure } from './list';
import { keywordsRefreshProcedure } from './refresh';
import { keywordsTrackProcedure } from './track';

export const keywordsRouter = router({
    getActivity: keywordsGetActivityProcedure,
    getDailyProductRanksForKeyword: keywordsGetDailyProductRanksForKeywordProcedure,
    list: keywordsListProcedure,
    refresh: keywordsRefreshProcedure,
    track: keywordsTrackProcedure,
});
