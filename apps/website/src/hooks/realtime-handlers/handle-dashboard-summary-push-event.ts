import { type DashboardSummary } from '@/lib/dashboard-api';
import { type RealtimeMessage } from '@/lib/realtime-message-types';
import { queryClient, trpc } from '@/lib/trpc-client';

const dashboardSummaryQueryKey = trpc.app.dashboard.getSummary.queryOptions({}).queryKey;

type DashboardSummaryPushMessage = Extract<RealtimeMessage, { type: 'dashboard-summary.push' }>;

export const handleDashboardSummaryPushEvent = (
    message: DashboardSummaryPushMessage
): void => {
    queryClient.setQueryData<DashboardSummary>(dashboardSummaryQueryKey, (current) => {
        if (!current) {
            return current;
        }

        return {
            ...current,
            inFlightJobs: message.jobCounts.inFlightJobs,
            queuedJobs: message.jobCounts.queuedJobs
        };
    });
};
