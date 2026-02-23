import { defineJob } from './job-router';
import {
    SYNC_CURRENCY_RATES_CRON,
    SYNC_CURRENCY_RATES_JOB_NAME,
    syncCurrencyRatesJobInputSchema
} from './sync-currency-rates-shared';
import { syncUsdRates } from '../services/currency/sync-usd-rates';

export const syncCurrencyRatesJob = defineJob(SYNC_CURRENCY_RATES_JOB_NAME, {
    persistSuccess: 'didWork'
})
    .input(syncCurrencyRatesJobInputSchema)
    .options({
        retryLimit: 0,
        singletonKey: SYNC_CURRENCY_RATES_JOB_NAME
    })
    .cron({
        cron: SYNC_CURRENCY_RATES_CRON,
        payload: {},
        scheduleOptions: {
            singletonKey: SYNC_CURRENCY_RATES_JOB_NAME
        }
    })
    .work(async (job, signal, log) => {
        void job;
        void signal;

        await syncUsdRates();

        log('Synced USD conversion rates from provider.');

        return {
            didWork: true
        } as const;
    });
