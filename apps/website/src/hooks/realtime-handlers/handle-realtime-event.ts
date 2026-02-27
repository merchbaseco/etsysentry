import { handleDashboardSummaryPushEvent } from '@/hooks/realtime-handlers/handle-dashboard-summary-push-event';
import { createQueryInvalidateEventHandler } from '@/hooks/realtime-handlers/handle-query-invalidate-event';
import { handleSyncStatePushEvent } from '@/hooks/realtime-handlers/handle-sync-state-push-event';
import type { RealtimeMessage } from '@/lib/realtime-message-types';

export interface RealtimeEventHandler {
    cleanup: () => void;
    handleRealtimeEvent: (message: RealtimeMessage) => void;
}

export const createRealtimeEventHandler = (): RealtimeEventHandler => {
    const queryInvalidateEventHandler = createQueryInvalidateEventHandler();

    const handleRealtimeEvent = (message: RealtimeMessage): void => {
        switch (message.type) {
            case 'query.invalidate':
                queryInvalidateEventHandler.handleQueryInvalidateEvent(message.queries);
                return;
            case 'sync-state.push':
                handleSyncStatePushEvent(message);
                return;
            case 'dashboard-summary.push':
                handleDashboardSummaryPushEvent(message);
                return;
            default:
                return;
        }
    };

    const cleanup = (): void => {
        queryInvalidateEventHandler.cleanup();
    };

    return {
        cleanup,
        handleRealtimeEvent,
    };
};
