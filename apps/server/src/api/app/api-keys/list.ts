import { z } from 'zod';
import { listApiKeysByAccountId } from '../../../services/auth/api-keys-service';
import { appProcedure } from '../../trpc';

export const apiKeysListProcedure = appProcedure.input(z.object({})).query(({ ctx }) => {
    return listApiKeysByAccountId({
        accountId: ctx.accountId,
    });
});
