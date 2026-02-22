import { router } from '../../trpc';
import { etsyAuthDisconnectProcedure } from './disconnect';
import { etsyAuthRefreshProcedure } from './refresh';
import { etsyAuthStartProcedure } from './start';
import { etsyAuthStatusProcedure } from './status';

export const etsyAuthRouter = router({
    disconnect: etsyAuthDisconnectProcedure,
    refresh: etsyAuthRefreshProcedure,
    start: etsyAuthStartProcedure,
    status: etsyAuthStatusProcedure
});
