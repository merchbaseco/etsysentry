import { z } from 'zod';
import { adminProcedure } from '../../trpc';

export const adminStatusProcedure = adminProcedure.input(z.object({})).query(({ ctx }) => {
    return {
        email: null,
        isAdmin: true,
        accountId: ctx.accountId,
    };
});
