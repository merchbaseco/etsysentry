import { trpc } from '@/lib/trpc-client';

export const dashboardSummaryQueryOptions = trpc.app.dashboard.getSummary.queryOptions({});
export const dashboardSummaryQueryKey = dashboardSummaryQueryOptions.queryKey;
