import { describe, expect, mock, test } from 'bun:test';
import { runStartupReconciliation, type StartupReconciliationTask } from './startup-reconciliation';

describe('runStartupReconciliation', () => {
    test('aggregates startup reconciliation task results', async () => {
        const tasks: StartupReconciliationTask[] = [
            {
                name: 'task.one',
                run: async () => ({
                    checkedCount: 2,
                    fixedCount: 1,
                    summary: 'checked 2 and fixed 1',
                }),
            },
            {
                name: 'task.two',
                run: async () => ({
                    checkedCount: 3,
                    fixedCount: 2,
                    summary: 'checked 3 and fixed 2',
                }),
            },
        ];
        const logger = {
            error: mock(() => undefined),
            info: mock(() => undefined),
            warn: mock(() => undefined),
        };

        const result = await runStartupReconciliation({
            boss: {
                findJobs: mock(async () => []),
            },
            logger,
            tasks,
        });

        expect(result).toEqual({
            checkedCount: 5,
            fixedCount: 3,
            summaries: ['task.one: checked 2 and fixed 1', 'task.two: checked 3 and fixed 2'],
            taskCount: 2,
        });
        expect(logger.warn).toHaveBeenCalledTimes(0);
    });

    test('continues when a task fails', async () => {
        const tasks: StartupReconciliationTask[] = [
            {
                name: 'task.fail',
                run: () => Promise.reject(new Error('boom')),
            },
            {
                name: 'task.ok',
                run: async () => ({
                    checkedCount: 1,
                    fixedCount: 1,
                    summary: 'fixed one row',
                }),
            },
        ];
        const logger = {
            error: mock(() => undefined),
            info: mock(() => undefined),
            warn: mock(() => undefined),
        };

        const result = await runStartupReconciliation({
            boss: {
                findJobs: mock(async () => []),
            },
            logger,
            tasks,
        });

        expect(result.checkedCount).toBe(1);
        expect(result.fixedCount).toBe(1);
        expect(result.summaries).toEqual(['task.fail: failed', 'task.ok: fixed one row']);
        expect(result.taskCount).toBe(2);
        expect(logger.warn).toHaveBeenCalledTimes(1);
    });
});
