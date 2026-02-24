import type { PgBoss } from 'pg-boss';
import type { JobsLogger } from './jobs-logger';

export type StartupReconciliationTaskResult = {
    checkedCount: number;
    fixedCount: number;
    summary: string;
};

export type StartupReconciliationTask = {
    name: string;
    run: (params: {
        boss: Pick<PgBoss, 'findJobs'>;
    }) => Promise<StartupReconciliationTaskResult>;
};

export type StartupReconciliationSummary = {
    checkedCount: number;
    fixedCount: number;
    summaries: string[];
    taskCount: number;
};

export const runStartupReconciliation = async (params: {
    boss: Pick<PgBoss, 'findJobs'>;
    logger: JobsLogger;
    tasks: StartupReconciliationTask[];
}): Promise<StartupReconciliationSummary> => {
    let checkedCount = 0;
    let fixedCount = 0;
    const summaries: string[] = [];

    for (const task of params.tasks) {
        try {
            const result = await task.run({
                boss: params.boss
            });

            checkedCount += result.checkedCount;
            fixedCount += result.fixedCount;
            summaries.push(`${task.name}: ${result.summary}`);
        } catch (error) {
            params.logger.warn(
                {
                    error,
                    taskName: task.name
                },
                'Startup reconciliation task failed; continuing startup.'
            );
            summaries.push(`${task.name}: failed`);
        }
    }

    return {
        checkedCount,
        fixedCount,
        summaries,
        taskCount: params.tasks.length
    };
};
