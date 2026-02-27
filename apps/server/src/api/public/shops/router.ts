import { router } from '../../trpc';
import { publicShopsListProcedure } from './list';
import { publicShopsTrackProcedure } from './track';

export const publicShopsRouter = router({
    list: publicShopsListProcedure,
    track: publicShopsTrackProcedure,
});
