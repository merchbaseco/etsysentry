import { describe, expect, test } from 'bun:test';
import { sumDashboardJobCounts } from './get-dashboard-job-counts';

describe('sumDashboardJobCounts', () => {
    test('aggregates queued and in-flight counts across primitives', () => {
        const result = sumDashboardJobCounts([
            {
                inFlightJobs: 2,
                queuedJobs: 1,
            },
            {
                inFlightJobs: 4,
                queuedJobs: 3,
            },
            {
                inFlightJobs: 6,
                queuedJobs: 5,
            },
        ]);

        expect(result).toEqual({
            inFlightJobs: 12,
            queuedJobs: 9,
        });
    });

    test('returns zeros when no counts are present', () => {
        expect(sumDashboardJobCounts([])).toEqual({
            inFlightJobs: 0,
            queuedJobs: 0,
        });
    });
});
