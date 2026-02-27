import { z } from 'zod';
import { refreshEtsyOAuthAccessToken } from '../../../services/etsy/oauth-service';
import { appProcedure } from '../../trpc';

export const etsyAuthRefreshProcedure = appProcedure
    .input(z.object({}))
    .mutation(async ({ ctx }) => {
        const status = await refreshEtsyOAuthAccessToken({
            accountId: ctx.accountId,
        });

        return {
            connected: status.connected,
            expiresAt: status.expiresAt ? status.expiresAt.toISOString() : null,
            needsRefresh: status.needsRefresh,
            scopes: status.scopes,
        };
    });
