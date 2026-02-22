import { z } from 'zod';
import { adminProcedure } from '../../trpc';

export const adminStatusProcedure = adminProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
        return {
            email: ctx.user.email ?? null,
            isAdmin: true,
            tenantId: ctx.tenantId
        };
    });
