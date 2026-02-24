import { PgBoss } from 'pg-boss';
import { env } from '../config/env';
import {
    startRegisteredJobs,
    type StartRegisteredJobsResult
} from './job-router';
import { createJobsLogger, type JobsLogger } from './jobs-logger';
import {
    type SyncListingJobInput
} from './sync-listing-shared';
import {
    type SyncShopJobInput
} from './sync-shop-shared';
import {
    type SyncKeywordJobInput
} from './sync-keyword-shared';
import { enqueueSyncKeywordJob } from '../services/keywords/enqueue-sync-keyword-job';
import { enqueueSyncListingJob } from '../services/listings/enqueue-sync-listing-job';
import { enqueueSyncShopJob } from '../services/shops/enqueue-sync-shop-job';
import { startupReconciliationTasks } from './startup-reconciliation-tasks';
import { runStartupReconciliation } from './startup-reconciliation';
import './sync-currency-rates';
import './sync-listing';
import './sync-stale-listings';
import './sync-shop';
import './sync-keyword';
import './sync-stale-keywords';
import './sync-stale-shops';

const defaultLogger = createJobsLogger({
    scope: 'jobs.sync-keyword'
});

let boss: PgBoss | null = null;
let jobsRuntime: StartRegisteredJobsResult | null = null;
let logger: JobsLogger = defaultLogger;
let startPromise: Promise<void> | null = null;

const getBoss = () => {
    if (!boss) {
        boss = new PgBoss({
            database: env.databaseName,
            host: env.databaseHost,
            password: env.databasePassword,
            port: env.databasePort,
            user: env.databaseUser
        });

        boss.on('error', (error) => {
            logger.error({ error }, 'pg-boss emitted an error event.');
        });
    }

    return boss;
};

const sendKeywordSyncJob = async (payload: SyncKeywordJobInput): Promise<string | null> => {
    if (!boss) {
        return null;
    }

    return enqueueSyncKeywordJob({
        boss,
        payload
    });
};

const sendListingSyncJob = async (payload: SyncListingJobInput): Promise<string | null> => {
    if (!boss) {
        return null;
    }

    return enqueueSyncListingJob({
        boss,
        payload
    });
};

const sendShopSyncJob = async (payload: SyncShopJobInput): Promise<string | null> => {
    if (!boss) {
        return null;
    }

    return enqueueSyncShopJob({
        boss,
        payload
    });
};

export const startKeywordSyncJobs = async (params?: {
    logger?: JobsLogger;
}): Promise<void> => {
    if (startPromise) {
        await startPromise;
        return;
    }

    logger = createJobsLogger({
        baseLogger: params?.logger,
        scope: 'jobs.sync-keyword'
    });

    startPromise = (async () => {
        const queue = getBoss();

        await queue.start();
        const startupReconciliationSummary = await runStartupReconciliation({
            boss: queue,
            logger,
            tasks: startupReconciliationTasks
        });
        jobsRuntime = await startRegisteredJobs({
            boss: queue,
            logger
        });

        logger.info(
            {
                startupReconciliation: startupReconciliationSummary,
                startupSummary: jobsRuntime.startupSummary
            },
            'Keyword sync automation jobs started.'
        );
    })();

    await startPromise;
};

export const stopKeywordSyncJobs = async (): Promise<void> => {
    if (!boss) {
        return;
    }

    if (jobsRuntime) {
        await jobsRuntime.stop();
        jobsRuntime = null;
    }

    await boss.stop();
    boss = null;
    startPromise = null;
};

export const enqueueKeywordSyncJob = async (
    payload: SyncKeywordJobInput
): Promise<string | null> => {
    return sendKeywordSyncJob(payload);
};

export const enqueueListingSyncJob = async (
    payload: SyncListingJobInput
): Promise<string | null> => {
    return sendListingSyncJob(payload);
};

export const enqueueShopSyncJob = async (
    payload: SyncShopJobInput
): Promise<string | null> => {
    return sendShopSyncJob(payload);
};
