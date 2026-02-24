import type { StartupReconciliationTask } from './startup-reconciliation';
import {
    reconcileTrackedListingSyncState
} from '../services/listings/reconcile-tracked-listing-sync-state';
import {
    reconcileTrackedKeywordSyncState
} from '../services/keywords/reconcile-tracked-keyword-sync-state';
import {
    reconcileTrackedShopSyncState
} from '../services/shops/reconcile-tracked-shop-sync-state';

export const startupReconciliationTasks: StartupReconciliationTask[] = [
    {
        name: 'tracked-keywords.sync-state',
        run: async ({ boss }) => {
            const result = await reconcileTrackedKeywordSyncState({
                boss
            });

            return {
                checkedCount: result.checkedCount,
                fixedCount: result.fixedCount,
                summary: result.summary
            };
        }
    },
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
    },
    {
        name: 'tracked-shops.sync-state',
        run: async ({ boss }) => {
            const result = await reconcileTrackedShopSyncState({
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
