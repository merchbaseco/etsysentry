import { router } from '../trpc';
import { etsyAuthRouter } from './etsy-auth/router';
import { listingsRouter } from './listings/router';

export const appRouter = router({
    etsyAuth: etsyAuthRouter,
    listings: listingsRouter
});
