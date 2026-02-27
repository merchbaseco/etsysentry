import type { ListTrackedKeywordsOutput } from '@/lib/keywords-api';
import type { ListTrackedListingsOutput } from '@/lib/listings-api';
import type { RealtimeMessage } from '@/lib/realtime-message-types';
import type { ListTrackedShopsOutput } from '@/lib/shops-api';
import { queryClient, trpc } from '@/lib/trpc-client';

const listingsInvalidatedEventName = 'etsysentry:listings-invalidated';
const trackedListingsQueryKey = trpc.app.listings.list.queryOptions({}).queryKey;
const trackedKeywordsQueryKey = trpc.app.keywords.list.queryOptions({}).queryKey;
const trackedShopsQueryKey = trpc.app.shops.list.queryOptions({}).queryKey;

type SyncStatePushMessage = Extract<RealtimeMessage, { type: 'sync-state.push' }>;

const patchItemsSyncState = <TItem extends { id: string; syncState: string }>(
    items: TItem[],
    ids: SyncStatePushMessage['ids']
): TItem[] => {
    let hasChange = false;
    const nextItems = items.map((item) => {
        const nextSyncState = ids[item.id];

        if (!nextSyncState || item.syncState === nextSyncState) {
            return item;
        }

        hasChange = true;

        return {
            ...item,
            syncState: nextSyncState,
        };
    });

    return hasChange ? nextItems : items;
};

export const handleSyncStatePushEvent = (message: SyncStatePushMessage): void => {
    if (message.entity === 'listing') {
        queryClient.setQueryData<ListTrackedListingsOutput>(trackedListingsQueryKey, (current) => {
            if (!current) {
                return current;
            }

            return {
                ...current,
                items: patchItemsSyncState(current.items, message.ids),
            };
        });
        window.dispatchEvent(
            new CustomEvent(listingsInvalidatedEventName, {
                detail: {
                    reason: 'sync-state.push',
                },
            })
        );
        return;
    }

    if (message.entity === 'keyword') {
        queryClient.setQueryData<ListTrackedKeywordsOutput>(trackedKeywordsQueryKey, (current) => {
            if (!current) {
                return current;
            }

            return {
                ...current,
                items: patchItemsSyncState(current.items, message.ids),
            };
        });
        return;
    }

    queryClient.setQueryData<ListTrackedShopsOutput>(trackedShopsQueryKey, (current) => {
        if (!current) {
            return current;
        }

        return {
            ...current,
            items: patchItemsSyncState(current.items, message.ids),
        };
    });
};
