import { z } from 'zod';
import { loadUsdRatesStatus } from '../../../services/currency/load-usd-rates-cache';
import { appProcedure } from '../../trpc';

export const currencyGetStatusProcedure = appProcedure.input(z.object({})).query(() => {
    return loadUsdRatesStatus();
});
