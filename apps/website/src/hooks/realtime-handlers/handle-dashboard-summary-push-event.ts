import type { DashboardSummary } from '@/lib/dashboard-api';
import { dashboardSummaryQueryKey } from '@/lib/dashboard-summary-query';
import type { RealtimeMessage } from '@/lib/realtime-message-types';
import { queryClient } from '@/lib/trpc-client';

type DashboardSummaryPushMessage = Extract<RealtimeMessage, { type: 'dashboard-summary.push' }>;

export const handleDashboardSummaryPushEvent = (message: DashboardSummaryPushMessage): void => {
    queryClient.setQueryData<DashboardSummary>(dashboardSummaryQueryKey, (current) => {
        if (!current) {
            return current;
        }

        return {
            ...current,
            inFlightJobs: message.jobCounts.inFlightJobs,
            queuedJobs: message.jobCounts.queuedJobs,
        };
    });
};
