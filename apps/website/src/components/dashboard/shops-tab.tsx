import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    type ListTrackedShopsOutput,
    listTrackedShops,
    refreshTrackedShop,
    trackShop,
    type TrackedShopItem
} from '@/lib/shops-api';
import { TrpcRequestError } from '@/lib/trpc-http';
import { queryClient, trpc } from '@/lib/trpc-client';
import { cn } from '@/lib/utils';
import {
    EmptyState,
    FilterChip,
    FilterGroup,
    TopToolbar
} from '@/components/ui/dashboard';
import { ShopsTable } from './shops-table';

const trackedShopsQueryKey = trpc.app.shops.list.queryOptions({}).queryKey;
const trackedShopsQueryKeyJson = JSON.stringify(trackedShopsQueryKey);

const toErrorMessage = (error: unknown): string => {
    if (error instanceof TrpcRequestError) {
        return error.message;
    }

    if (error instanceof Error && error.message.length > 0) {
        return error.message;
    }

    return 'Unexpected request failure.';
};

const upsertById = (items: TrackedShopItem[], nextItem: TrackedShopItem): TrackedShopItem[] => {
    const existingIndex = items.findIndex((item) => item.id === nextItem.id);

    if (existingIndex === -1) {
        return [nextItem, ...items];
    }

    const clone = [...items];
    clone[existingIndex] = nextItem;

    return clone;
};

const isShopSyncInFlight = (item: TrackedShopItem): boolean => {
    return item.syncState === 'queued' || item.syncState === 'syncing';
};

export function ShopsTab() {
    const cachedTrackedShops = queryClient.getQueryData<ListTrackedShopsOutput>(trackedShopsQueryKey);
    const initialItems = cachedTrackedShops?.items ?? [];

    const [search, setSearch] = useState('');
    const [trackingStateFilter, setTrackingStateFilter] = useState<
        'active' | 'paused' | 'error' | null
    >(null);
    const [items, setItems] = useState<TrackedShopItem[]>(() => initialItems);
    const [isLoading, setIsLoading] = useState(() => initialItems.length === 0);
    const [isTracking, setIsTracking] = useState(false);
    const [refreshingById, setRefreshingById] = useState<Record<string, boolean>>({});
    const [shopInput, setShopInput] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const scrollViewportRef = useRef<HTMLDivElement | null>(null);

    const loadShops = useCallback(async () => {
        try {
            const response = await listTrackedShops({});

            setItems(response.items);
            queryClient.setQueryData(trackedShopsQueryKey, response);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadShops();
    }, [loadShops]);

    useEffect(() => {
        return queryClient.getQueryCache().subscribe((event) => {
            if (JSON.stringify(event.query.queryKey) !== trackedShopsQueryKeyJson) {
                return;
            }

            const data = event.query.state.data as ListTrackedShopsOutput | undefined;

            if (!data) {
                return;
            }

            setItems(data.items);
            setIsLoading(false);
        });
    }, []);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        return items.filter((item) => {
            if (trackingStateFilter && item.trackingState !== trackingStateFilter) {
                return false;
            }

            if (query.length === 0) {
                return true;
            }

            return item.shopName.toLowerCase().includes(query) || item.etsyShopId.includes(query);
        });
    }, [items, search, trackingStateFilter]);
    const tableResetKey = `${search}|${trackingStateFilter ?? 'all'}`;

    useEffect(() => {
        scrollViewportRef.current?.scrollTo({
            top: 0
        });
    }, [tableResetKey]);

    const handleTrack = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!shopInput.trim()) {
            return;
        }

        setIsTracking(true);

        try {
            const response = await trackShop({
                shop: shopInput
            });

            setItems((current) => {
                const nextItems = upsertById(current, response.item);

                queryClient.setQueryData<ListTrackedShopsOutput>(trackedShopsQueryKey, {
                    items: nextItems
                });

                return nextItems;
            });
            setShopInput('');
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
        } finally {
            setIsTracking(false);
        }
    };

    const handleRefreshRow = async (item: TrackedShopItem): Promise<void> => {
        if (isShopSyncInFlight(item) || refreshingById[item.id] === true) {
            return;
        }

        setRefreshingById((current) => ({
            ...current,
            [item.id]: true
        }));

        try {
            const refreshed = await refreshTrackedShop({
                trackedShopId: item.id
            });

            setItems((current) => {
                const nextItems = upsertById(current, refreshed);

                queryClient.setQueryData<ListTrackedShopsOutput>(trackedShopsQueryKey, {
                    items: nextItems
                });

                return nextItems;
            });
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
            void loadShops();
        } finally {
            setRefreshingById((current) => ({
                ...current,
                [item.id]: false
            }));
        }
    };

    return (
        <div className="flex h-full flex-col">
            <TopToolbar search={search} onSearchChange={setSearch}>
                <FilterGroup label="Tracking">
                    {(['active', 'paused', 'error'] as const).map((stateValue) => (
                        <FilterChip
                            key={stateValue}
                            label={stateValue}
                            active={trackingStateFilter === stateValue}
                            onClick={() =>
                                setTrackingStateFilter(
                                    trackingStateFilter === stateValue ? null : stateValue
                                )
                            }
                        />
                    ))}
                </FilterGroup>
            </TopToolbar>

            <form
                onSubmit={handleTrack}
                className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs"
            >
                <input
                    value={shopInput}
                    onChange={(event) => setShopInput(event.target.value)}
                    type="text"
                    placeholder="Paste Etsy shop URL, shop id, or shop name"
                    className="h-8 flex-1 rounded border border-border bg-secondary px-2 text-xs outline-none placeholder:text-muted-foreground"
                />
                <button
                    type="submit"
                    disabled={isTracking}
                    className={cn(
                        'h-8 rounded border border-border bg-secondary px-3 text-[11px] uppercase tracking-wider transition-colors',
                        'disabled:cursor-default disabled:opacity-50',
                        'hover:text-foreground'
                    )}
                >
                    {isTracking ? 'Tracking...' : 'Track Shop'}
                </button>
            </form>

            {errorMessage ? (
                <div className="border-b border-terminal-red/20 bg-terminal-red/10 px-3 py-2 text-xs text-terminal-red">
                    {errorMessage}
                </div>
            ) : null}

            <div ref={scrollViewportRef} className="min-h-0 flex-1 overflow-auto">
                {isLoading ? (
                    <div className="px-3 py-6 text-xs text-muted-foreground">Loading tracked shops...</div>
                ) : filtered.length === 0 ? (
                    <EmptyState message="No tracked shops yet. Add one above." />
                ) : (
                    <ShopsTable
                        items={filtered}
                        refreshingById={refreshingById}
                        onRefresh={(item) => void handleRefreshRow(item)}
                        resetKey={tableResetKey}
                        scrollContainerRef={scrollViewportRef}
                    />
                )}
            </div>
        </div>
    );
}
