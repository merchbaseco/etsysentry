import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { deleteApiKeyById } from '../../../services/auth/api-keys-service';
import { appProcedure } from '../../trpc';

export const apiKeysRevokeProcedure = appProcedure
    .input(
        z.object({
            apiKeyId: z.string().uuid(),
        })
    )
    .mutation(async ({ ctx, input }) => {
        const deleted = await deleteApiKeyById({
            accountId: ctx.accountId,
            apiKeyId: input.apiKeyId,
        });

        if (!deleted) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'API key not found for this account.',
            });
        }

        return deleted;
    });
