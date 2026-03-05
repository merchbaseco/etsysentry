import { router } from '../../../trpc';
import { publicKeywordsListingsListProcedure } from './list';

export const publicKeywordsListingsRouter = router({
    list: publicKeywordsListingsListProcedure,
});
