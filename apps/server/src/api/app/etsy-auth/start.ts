import { z } from 'zod';
import { startEtsyOAuthFlow } from '../../../services/etsy/oauth-service';
import { appProcedure } from '../../trpc';

export const etsyAuthStartProcedure = appProcedure
    .input(z.object({}))
    .mutation(async ({ ctx }) => {
        const flow = startEtsyOAuthFlow({
            accountId: ctx.accountId
        });

        return {
            authorizationUrl: flow.authorizationUrl,
            expiresAt: flow.expiresAt.toISOString()
        };
    });
