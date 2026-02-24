import { z } from 'zod';
import { getEtsyOAuthStatus } from '../../../services/etsy/oauth-service';
import { appProcedure } from '../../trpc';

export const etsyAuthStatusProcedure = appProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
        const status = await getEtsyOAuthStatus({
            accountId: ctx.accountId
        });

        return {
            connected: status.connected,
            expiresAt: status.expiresAt ? status.expiresAt.toISOString() : null,
            needsRefresh: status.needsRefresh,
            scopes: status.scopes
        };
    });
