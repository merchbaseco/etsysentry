import { z } from 'zod';
import { startEtsyOAuthFlow } from '../../../services/etsy/oauth-service';
import { appProcedure } from '../../trpc';

export const etsyAuthStartProcedure = appProcedure
    .input(z.object({}))
    .mutation(async () => {
        const flow = startEtsyOAuthFlow();

        return {
            authorizationUrl: flow.authorizationUrl,
            expiresAt: flow.expiresAt.toISOString(),
            oauthSessionId: flow.oauthSessionId
        };
    });
