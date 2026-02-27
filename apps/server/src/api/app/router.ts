import { router } from '../trpc';
import { adminRouter } from './admin/router';
import { apiKeysRouter } from './api-keys/router';
import { currencyRouter } from './currency/router';
import { dashboardRouter } from './dashboard/router';
import { etsyAuthRouter } from './etsy-auth/router';
import { keywordsRouter } from './keywords/router';
import { listingsRouter } from './listings/router';
import { logsRouter } from './logs/router';
import { shopsRouter } from './shops/router';

export const appRouter = router({
    admin: adminRouter,
    apiKeys: apiKeysRouter,
    dashboard: dashboardRouter,
    currency: currencyRouter,
    etsyAuth: etsyAuthRouter,
    keywords: keywordsRouter,
    listings: listingsRouter,
    logs: logsRouter,
    shops: shopsRouter,
});
