import { dashboardSummaryQueryKey } from '@/lib/dashboard-summary-query';

const persistedDashboardSummaryQueryKeyHash = JSON.stringify(dashboardSummaryQueryKey);

export const shouldPersistDashboardSummaryQuery = (queryKey: unknown): boolean => {
    return JSON.stringify(queryKey) === persistedDashboardSummaryQueryKeyHash;
};
