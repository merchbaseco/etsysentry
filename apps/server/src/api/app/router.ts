import { router } from '../trpc';
import { adminRouter } from './admin/router';
import { currencyRouter } from './currency/router';
import { etsyAuthRouter } from './etsy-auth/router';
import { keywordsRouter } from './keywords/router';
import { listingsRouter } from './listings/router';
import { logsRouter } from './logs/router';

export const appRouter = router({
    admin: adminRouter,
    currency: currencyRouter,
    etsyAuth: etsyAuthRouter,
    keywords: keywordsRouter,
    listings: listingsRouter,
    logs: logsRouter
});
