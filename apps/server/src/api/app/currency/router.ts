import { router } from '../../trpc';
import { currencyGetStatusProcedure } from './get-status';
import { currencyRefreshProcedure } from './refresh';

export const currencyRouter = router({
    getStatus: currencyGetStatusProcedure,
    refresh: currencyRefreshProcedure
});
