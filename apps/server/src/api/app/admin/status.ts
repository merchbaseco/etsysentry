import { z } from 'zod';
import { adminProcedure } from '../../trpc';

export const adminStatusProcedure = adminProcedure.input(z.object({})).query(({ ctx }) => {
    return {
        email: ctx.user.email ?? null,
        isAdmin: true,
        accountId: ctx.accountId,
    };
});
