import { z } from 'zod';
import { refreshEtsyOAuthAccessToken } from '../../../services/etsy/oauth-service';
import { appProcedure } from '../../trpc';

export const etsyAuthRefreshProcedure = appProcedure
    .input(
        z.object({
            oauthSessionId: z.string().min(1)
        })
    )
    .mutation(async ({ input }) => {
        const status = await refreshEtsyOAuthAccessToken({
            oauthSessionId: input.oauthSessionId
        });

        return {
            connected: status.connected,
            expiresAt: status.expiresAt ? status.expiresAt.toISOString() : null,
            needsRefresh: status.needsRefresh,
            scopes: status.scopes
        };
    });
