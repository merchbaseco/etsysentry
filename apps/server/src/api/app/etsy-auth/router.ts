import { router } from '../../trpc';
import { etsyAuthRefreshProcedure } from './refresh';
import { etsyAuthStartProcedure } from './start';
import { etsyAuthStatusProcedure } from './status';

export const etsyAuthRouter = router({
    refresh: etsyAuthRefreshProcedure,
    start: etsyAuthStartProcedure,
    status: etsyAuthStatusProcedure
});
