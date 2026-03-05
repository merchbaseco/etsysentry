import { router } from '../../trpc';
import { publicKeywordsGetActivityProcedure } from './get-activity';
import { publicKeywordsGetDailyProductRanksForKeywordProcedure } from './get-daily-product-ranks-for-keyword';
import { publicKeywordsListProcedure } from './list';
import { publicKeywordsTrackProcedure } from './track';

export const publicKeywordsRouter = router({
    getActivity: publicKeywordsGetActivityProcedure,
    getDailyProductRanksForKeyword: publicKeywordsGetDailyProductRanksForKeywordProcedure,
    list: publicKeywordsListProcedure,
    track: publicKeywordsTrackProcedure,
});
