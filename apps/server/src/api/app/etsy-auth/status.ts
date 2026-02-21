import { z } from 'zod';
import { getEtsyOAuthStatus } from '../../../services/etsy/oauth-service';
import { appProcedure } from '../../trpc';

export const etsyAuthStatusProcedure = appProcedure
    .input(
        z.object({
            oauthSessionId: z.string().min(1)
        })
    )
    .query(async ({ input }) => {
        const status = await getEtsyOAuthStatus({
            oauthSessionId: input.oauthSessionId
        });

        return {
            connected: status.connected,
            expiresAt: status.expiresAt ? status.expiresAt.toISOString() : null,
            needsRefresh: status.needsRefresh,
            scopes: status.scopes
        };
    });
