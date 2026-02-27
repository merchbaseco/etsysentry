import { describe, expect, test } from 'bun:test';
import { shouldPersistDashboardSummaryQuery } from '@/lib/dashboard-summary-persistence';
import { dashboardSummaryQueryKey } from '@/lib/dashboard-summary-query';

describe('shouldPersistDashboardSummaryQuery', () => {
    test('returns true for the dashboard summary query key', () => {
        expect(shouldPersistDashboardSummaryQuery(dashboardSummaryQueryKey)).toBe(true);
    });

    test('returns false for non-dashboard query keys', () => {
        expect(shouldPersistDashboardSummaryQuery(['app', 'dashboard', 'listJobs'])).toBe(false);
    });
});
