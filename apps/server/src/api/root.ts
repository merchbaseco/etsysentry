import { appRouter } from './app/router';
import { publicRouter } from './public/router';
import { router } from './trpc';

export const rootRouter = router({
    app: appRouter,
    public: publicRouter,
});

export type RootRouter = typeof rootRouter;
