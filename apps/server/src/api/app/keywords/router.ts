import { router } from '../../trpc';
import { keywordsGetDailyProductRanksForKeywordProcedure } from './get-daily-product-ranks-for-keyword';
import { keywordsListProcedure } from './list';
import { keywordsSyncRanksForKeywordProcedure } from './sync-ranks-for-keyword';
import { keywordsTrackProcedure } from './track';

export const keywordsRouter = router({
    getDailyProductRanksForKeyword: keywordsGetDailyProductRanksForKeywordProcedure,
    list: keywordsListProcedure,
    syncRanksForKeyword: keywordsSyncRanksForKeywordProcedure,
    track: keywordsTrackProcedure
});
