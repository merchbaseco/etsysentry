import { router } from '../../trpc';
import { keywordsGetDailyProductRanksForKeywordProcedure } from './get-daily-product-ranks-for-keyword';
import { keywordsListProcedure } from './list';
import { keywordsTrackProcedure } from './track';

export const keywordsRouter = router({
    getDailyProductRanksForKeyword: keywordsGetDailyProductRanksForKeywordProcedure,
    list: keywordsListProcedure,
    track: keywordsTrackProcedure
});
