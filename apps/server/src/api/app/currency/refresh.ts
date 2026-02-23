import { z } from 'zod';
import { loadUsdRatesStatus } from '../../../services/currency/load-usd-rates-cache';
import { syncUsdRates } from '../../../services/currency/sync-usd-rates';
import { appProcedure } from '../../trpc';

export const currencyRefreshProcedure = appProcedure
    .input(z.object({}))
    .mutation(async () => {
        await syncUsdRates();
        return loadUsdRatesStatus();
    });
