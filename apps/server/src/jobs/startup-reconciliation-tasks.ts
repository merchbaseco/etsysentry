import type { StartupReconciliationTask } from './startup-reconciliation';
import {
    reconcileTrackedListingSyncState
} from '../services/listings/reconcile-tracked-listing-sync-state';

export const startupReconciliationTasks: StartupReconciliationTask[] = [
    {
        name: 'tracked-listings.sync-state',
        run: async ({ boss }) => {
            const result = await reconcileTrackedListingSyncState({
                boss
            });

            return {
                checkedCount: result.checkedCount,
                fixedCount: result.fixedCount,
                summary: result.summary
            };
        }
    }
];
