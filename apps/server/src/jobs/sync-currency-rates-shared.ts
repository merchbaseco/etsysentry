import { z } from 'zod';

export const SYNC_CURRENCY_RATES_CRON = '0 */6 * * *';
export const SYNC_CURRENCY_RATES_JOB_NAME = 'sync-currency-rates';

export const syncCurrencyRatesJobInputSchema = z.record(z.string(), z.unknown());
