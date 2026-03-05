import { router } from '../../trpc';
import { publicKeywordsGetActivityProcedure } from './get-activity';
import { publicKeywordsListProcedure } from './list';
import { publicKeywordsListingsRouter } from './listings/router';
import { publicKeywordsTrackProcedure } from './track';

export const publicKeywordsRouter = router({
    getActivity: publicKeywordsGetActivityProcedure,
    list: publicKeywordsListProcedure,
    listings: publicKeywordsListingsRouter,
    track: publicKeywordsTrackProcedure,
});
