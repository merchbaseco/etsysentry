import { router } from '../../trpc';
import { logsListProcedure } from './list';

export const logsRouter = router({
    list: logsListProcedure,
});
