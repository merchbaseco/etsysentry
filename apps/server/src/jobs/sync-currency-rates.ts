import { syncUsdRates } from '../services/currency/sync-usd-rates';
import { defineJob } from './job-router';
import {
    SYNC_CURRENCY_RATES_CRON,
    SYNC_CURRENCY_RATES_JOB_NAME,
    syncCurrencyRatesJobInputSchema,
} from './sync-currency-rates-shared';

export const syncCurrencyRatesJob = defineJob(SYNC_CURRENCY_RATES_JOB_NAME, {
    persistSuccess: 'didWork',
})
    .input(syncCurrencyRatesJobInputSchema)
    .options({
        retryLimit: 0,
        singletonKey: SYNC_CURRENCY_RATES_JOB_NAME,
    })
    .cron({
        cron: SYNC_CURRENCY_RATES_CRON,
        payload: {},
        scheduleOptions: {
            singletonKey: SYNC_CURRENCY_RATES_JOB_NAME,
        },
    })
    .work(async (_job, _signal, log) => {
        await syncUsdRates();

        log('Synced USD conversion rates from provider.');

        return {
            didWork: true,
        } as const;
    });
