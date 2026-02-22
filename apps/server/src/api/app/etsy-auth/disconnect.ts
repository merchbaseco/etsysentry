import { z } from 'zod';
import { disconnectEtsyOAuthSession } from '../../../services/etsy/oauth-service';
import { appProcedure } from '../../trpc';

export const etsyAuthDisconnectProcedure = appProcedure
    .input(
        z.object({
            oauthSessionId: z.string().min(1)
        })
    )
    .mutation(async ({ input }) => {
        const status = await disconnectEtsyOAuthSession({
            oauthSessionId: input.oauthSessionId
        });

        return {
            connected: status.connected,
            expiresAt: status.expiresAt ? status.expiresAt.toISOString() : null,
            needsRefresh: status.needsRefresh,
            scopes: status.scopes
        };
    });
