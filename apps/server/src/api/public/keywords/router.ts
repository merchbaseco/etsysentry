import { router } from '../../trpc';
import { publicKeywordsListProcedure } from './list';
import { publicKeywordsTrackProcedure } from './track';

export const publicKeywordsRouter = router({
    list: publicKeywordsListProcedure,
    track: publicKeywordsTrackProcedure,
});
