import { useQuery } from '@tanstack/react-query';
import { dashboardSummaryQueryOptions } from '@/lib/dashboard-summary-query';

export const useDashboardSummaryQuery = () => {
    return useQuery({
        ...dashboardSummaryQueryOptions,
        refetchInterval: 60_000,
    });
};
