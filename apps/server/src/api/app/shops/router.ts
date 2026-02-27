import { router } from '../../trpc';
import { shopsListProcedure } from './list';
import { shopsRefreshProcedure } from './refresh';
import { shopsTrackProcedure } from './track';

export const shopsRouter = router({
    list: shopsListProcedure,
    refresh: shopsRefreshProcedure,
    track: shopsTrackProcedure,
});
