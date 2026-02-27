import { router } from '../trpc';
import { publicKeywordsRouter } from './keywords/router';
import { publicListingsRouter } from './listings/router';
import { publicShopsRouter } from './shops/router';

export const publicRouter = router({
    keywords: publicKeywordsRouter,
    listings: publicListingsRouter,
    shops: publicShopsRouter,
});
