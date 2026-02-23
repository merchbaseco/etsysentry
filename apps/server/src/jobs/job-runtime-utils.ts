import type { SendOptions } from 'pg-boss';
import type { JobsLogger } from './jobs-logger';

export type JobLogLevel = 'info' | 'warn' | 'error';

export type JobLogFn = (
    message: string,
    context?: unknown,
    level?: JobLogLevel
) => void;

type JobSchedule =
    | {
          type: 'interval';
          everyMs: number;
          payload: unknown;
          sendOptions?: SendOptions;
      }
    | {
          type: 'cron';
          cron: string;
          payload: unknown;
          scheduleOptions?: SendOptions;
      };

const formatInterval = (everyMs: number) => {
    if (everyMs % (60 * 60 * 1000) === 0) {
        return `${everyMs / (60 * 60 * 1000)}h`;
    }

    if (everyMs % (60 * 1000) === 0) {
        return `${everyMs / (60 * 1000)}m`;
    }

    if (everyMs % 1000 === 0) {
        return `${everyMs / 1000}s`;
    }

    return `${everyMs}ms`;
};

export const buildStartupSummary = (
    schedule: JobSchedule | undefined,
    sendOptions: SendOptions
) => {
    if (!schedule) {
        return 'triggered manually';
    }

    if (schedule.type === 'cron') {
        return `cron: ${schedule.cron}`;
    }

    const intervalLabel = `interval: ${formatInterval(schedule.everyMs)}`;
    const singletonKey =
        schedule.sendOptions?.singletonKey ?? sendOptions.singletonKey;

    if (typeof singletonKey === 'string' && singletonKey.length > 0) {
        return `${intervalLabel}, singleton`;
    }

    return intervalLabel;
};

export const createJobLog = (
    jobName: string,
    logger: JobsLogger
): JobLogFn => {
    return (message, context, level = 'info') => {
        const payload = {
            context: context ?? null,
            jobName
        };

        if (level === 'warn') {
            logger.warn(payload, message);
            return;
        }

        if (level === 'error') {
            logger.error(payload, message);
            return;
        }

        logger.info(payload, message);
    };
};
