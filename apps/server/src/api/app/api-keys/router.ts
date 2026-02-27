import { router } from '../../trpc';
import { apiKeysCreateProcedure } from './create';
import { apiKeysListProcedure } from './list';
import { apiKeysRevokeProcedure } from './revoke';

export const apiKeysRouter = router({
    create: apiKeysCreateProcedure,
    list: apiKeysListProcedure,
    revoke: apiKeysRevokeProcedure,
});
