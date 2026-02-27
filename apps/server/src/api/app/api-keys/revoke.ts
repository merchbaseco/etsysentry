import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { revokeApiKeyById } from '../../../services/auth/api-keys-service';
import { appProcedure } from '../../trpc';

export const apiKeysRevokeProcedure = appProcedure
    .input(
        z.object({
            apiKeyId: z.string().uuid(),
        })
    )
    .mutation(async ({ ctx, input }) => {
        const revoked = await revokeApiKeyById({
            accountId: ctx.accountId,
            apiKeyId: input.apiKeyId,
        });

        if (!revoked) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'API key not found or already revoked for this account.',
            });
        }

        return revoked;
    });
