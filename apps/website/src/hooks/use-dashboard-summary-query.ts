import { useDashboardSummary } from '@/hooks/use-dashboard-summary';

export const useDashboardSummaryQuery = () => {
    return useDashboardSummary({
        refetchInterval: 60_000,
    });
};
