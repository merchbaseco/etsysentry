import { router } from '../../trpc';
import { adminStatusProcedure } from './status';

export const adminRouter = router({
    status: adminStatusProcedure
});
