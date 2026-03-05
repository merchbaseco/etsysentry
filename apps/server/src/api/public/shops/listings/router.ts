import { router } from '../../../trpc';
import { publicShopsListingsListProcedure } from './list';

export const publicShopsListingsRouter = router({
    list: publicShopsListingsListProcedure,
});
