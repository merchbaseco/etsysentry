import { describe, expect, test } from 'bun:test';
import { sumSyncJobCounts } from './get-dashboard-summary';

describe('sumSyncJobCounts', () => {
    test('sums queued and in-flight counts across primitives', () => {
        const result = sumSyncJobCounts([
            {
                inFlightJobs: 1,
                queuedJobs: 2
            },
            {
                inFlightJobs: 3,
                queuedJobs: 4
            },
            {
                inFlightJobs: 5,
                queuedJobs: 6
            }
        ]);

        expect(result).toEqual({
            inFlightJobs: 9,
            queuedJobs: 12
        });
    });

    test('returns zeros when no counts are provided', () => {
        expect(sumSyncJobCounts([])).toEqual({
            inFlightJobs: 0,
            queuedJobs: 0
        });
    });
});
