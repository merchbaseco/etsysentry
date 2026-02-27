import { router } from '../../trpc';
import { publicListingsGetPerformanceProcedure } from './get-performance';
import { publicListingsListProcedure } from './list';
import { publicListingsTrackProcedure } from './track';

export const publicListingsRouter = router({
    getPerformance: publicListingsGetPerformanceProcedure,
    list: publicListingsListProcedure,
    track: publicListingsTrackProcedure,
});
