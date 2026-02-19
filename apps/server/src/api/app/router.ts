import { router } from '../trpc';
import { etsyAuthRouter } from './etsy-auth/router';

export const appRouter = router({
    etsyAuth: etsyAuthRouter
});
