import { router } from '../trpc';
import { adminRouter } from './admin/router';
import { etsyAuthRouter } from './etsy-auth/router';
import { keywordsRouter } from './keywords/router';
import { listingsRouter } from './listings/router';

export const appRouter = router({
    admin: adminRouter,
    etsyAuth: etsyAuthRouter,
    keywords: keywordsRouter,
    listings: listingsRouter
});
