import { z } from 'zod';
import { createApiKey } from '../../../services/auth/api-keys-service';
import { appProcedure } from '../../trpc';

export const apiKeysCreateProcedure = appProcedure
    .input(
        z.object({
            name: z.string().trim().min(1).max(80).optional(),
        })
    )
    .mutation(({ ctx, input }) => {
        return createApiKey({
            accountId: ctx.accountId,
            ownerClerkUserId: ctx.user.sub,
            name: input.name ?? 'API key',
        });
    });
