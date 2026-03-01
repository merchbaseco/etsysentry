import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/ui/dashboard';
import { listingsInvalidatedEventName } from '@/hooks/use-realtime-query-invalidations';
import { useRefreshTrackedListing } from '@/hooks/use-refresh-tracked-listing';
import { useTrackListing } from '@/hooks/use-track-listing';
import { useTrackedListings } from '@/hooks/use-tracked-listings';
import type { ListTrackedListingsOutput, TrackedListingItem } from '@/lib/listings-api';
import { captureScrollAnchor, restoreScrollAnchor } from '@/lib/scroll-anchor';
import { queryClient, trpc } from '@/lib/trpc-client';
import { ListingHistoryDrawer } from './listing-history-drawer';
import { ListingsControls } from './listings-controls';
import {
    filterTrackedListings,
    isListingSyncInFlight,
    mergeTrackedListings,
    toListingsErrorMessage,
    toListingsInfiniteResetKey,
    upsertListingById,
} from './listings-tab-utils';
import { ListingsTable } from './listings-table';
import { MouseThumbnailTooltipPortal, useMouseThumbnailTooltip } from './mouse-thumbnail-tooltip';

const trackedListingsQueryKey = trpc.app.listings.list.queryOptions({}).queryKey;
const REALTIME_REFRESH_DEBOUNCE_MS = 200;

export function ListingsTab() {
    const cachedTrackedListings =
        queryClient.getQueryData<ListTrackedListingsOutput>(trackedListingsQueryKey);
    const initialItems = cachedTrackedListings?.items ?? [];
    const trackedListingsQuery = useTrackedListings(
        {},
        {
            enabled: false,
        }
    );
    const trackListingMutation = useTrackListing();
    const refreshTrackedListingMutation = useRefreshTrackedListing();
    const refetchTrackedListings = trackedListingsQuery.refetch;
    const [search, setSearch] = useState('');
    const [showPhysicalListings, setShowPhysicalListings] = useState(true);
    const [showDigitalListings, setShowDigitalListings] = useState(false);
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 40]);
    const [favsRange, setFavsRange] = useState<[number, number]>([0, 5000]);
    const [items, setItems] = useState<TrackedListingItem[]>(() => initialItems);
    const [isLoading, setIsLoading] = useState(() => initialItems.length === 0);
    const [refreshingById, setRefreshingById] = useState<Record<string, boolean>>({});
    const [historyListing, setHistoryListing] = useState<TrackedListingItem | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [listingInput, setListingInput] = useState('');
    const itemsRef = useRef<TrackedListingItem[]>(initialItems);
    const realtimeRefreshTimeoutRef = useRef<number | null>(null);
    const scrollViewportRef = useRef<HTMLDivElement | null>(null);
    const { hideTooltip, queueTooltipPositionUpdate, showTooltip, tooltip, tooltipRef } =
        useMouseThumbnailTooltip();
    const applyListings = useCallback(
        (nextItems: TrackedListingItem[], options?: { preserveScroll?: boolean }) => {
            const container = options?.preserveScroll ? scrollViewportRef.current : null;
            const anchor = container ? captureScrollAnchor(container) : null;

            itemsRef.current = nextItems;
            setItems(nextItems);
            queryClient.setQueryData<ListTrackedListingsOutput>(trackedListingsQueryKey, {
                items: nextItems,
            });

            if (!container) {
                return;
            }

            window.requestAnimationFrame(() => {
                restoreScrollAnchor(container, anchor);
            });
        },
        []
    );

    const loadListings = useCallback(
        async (options?: { preserveScroll?: boolean }) => {
            try {
                const result = await refetchTrackedListings();
                const response = result.data;

                if (!response) {
                    throw result.error ?? new Error('Failed to load tracked listings.');
                }

                const mergedItems = mergeTrackedListings(itemsRef.current, response.items);

                applyListings(mergedItems, options);
                setErrorMessage(null);
            } catch (error) {
                setErrorMessage(toListingsErrorMessage(error));
            } finally {
                setIsLoading(false);
            }
        },
        [applyListings, refetchTrackedListings]
    );

    useEffect(() => {
        loadListings();
    }, [loadListings]);
    useEffect(() => {
        const onListingsInvalidated = (event: Event) => {
            const detail = (event as CustomEvent<{ reason?: string }>).detail;

            if (detail?.reason === 'sync-state.push') {
                const cachedData =
                    queryClient.getQueryData<ListTrackedListingsOutput>(trackedListingsQueryKey);

                if (!cachedData) {
                    return;
                }

                const mergedItems = mergeTrackedListings(itemsRef.current, cachedData.items);
                applyListings(mergedItems, {
                    preserveScroll: true,
                });
                return;
            }

            if (realtimeRefreshTimeoutRef.current !== null) {
                return;
            }

            realtimeRefreshTimeoutRef.current = window.setTimeout(() => {
                realtimeRefreshTimeoutRef.current = null;
                loadListings({
                    preserveScroll: true,
                });
            }, REALTIME_REFRESH_DEBOUNCE_MS);
        };

        window.addEventListener(listingsInvalidatedEventName, onListingsInvalidated);

        return () => {
            if (realtimeRefreshTimeoutRef.current !== null) {
                window.clearTimeout(realtimeRefreshTimeoutRef.current);
                realtimeRefreshTimeoutRef.current = null;
            }

            window.removeEventListener(listingsInvalidatedEventName, onListingsInvalidated);
        };
    }, [applyListings, loadListings]);

    useEffect(() => {
        if (!historyListing) {
            return;
        }

        const nextSelectedListing = items.find((item) => item.id === historyListing.id) ?? null;

        if (!nextSelectedListing) {
            setHistoryListing(null);
            return;
        }

        if (nextSelectedListing !== historyListing) {
            setHistoryListing(nextSelectedListing);
        }
    }, [historyListing, items]);

    const filtered = useMemo(() => {
        return filterTrackedListings(items, {
            search,
            showPhysicalListings,
            showDigitalListings,
            priceRange,
            favsRange,
        });
    }, [favsRange, items, priceRange, search, showDigitalListings, showPhysicalListings]);
    const tableResetKey = toListingsInfiniteResetKey({
        search,
        priceRange,
        favsRange,
        showDigitalListings,
        showPhysicalListings,
    });

    useEffect(() => {
        scrollViewportRef.current?.scrollTo({
            top: 0,
        });
    }, []);

    const handleTrack = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!listingInput.trim()) {
            return;
        }

        try {
            const response = await trackListingMutation.mutateAsync({
                listing: listingInput,
            });

            const nextItems = upsertListingById(itemsRef.current, response.item);
            applyListings(nextItems);
            setListingInput('');
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toListingsErrorMessage(error));
        }
    };

    const handleRefreshRow = async (item: TrackedListingItem) => {
        if (isListingSyncInFlight(item) || refreshingById[item.id] === true) {
            return;
        }

        setRefreshingById((current) => ({
            ...current,
            [item.id]: true,
        }));

        try {
            const refreshed = await refreshTrackedListingMutation.mutateAsync({
                trackedListingId: item.id,
            });

            const nextItems = upsertListingById(itemsRef.current, refreshed);
            applyListings(nextItems);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toListingsErrorMessage(error));
            loadListings();
        } finally {
            setRefreshingById((current) => ({
                ...current,
                [item.id]: false,
            }));
        }
    };
    const isTracking = trackListingMutation.isPending;

    let listingsContent: ReactNode;
    if (isLoading) {
        listingsContent = (
            <div className="px-3 py-6 text-muted-foreground text-xs">
                Loading tracked listings...
            </div>
        );
    } else if (filtered.length === 0) {
        listingsContent = (
            <EmptyState message="No tracked listings yet. Add one with an Etsy URL above." />
        );
    } else {
        listingsContent = (
            <ListingsTable
                items={filtered}
                onRefresh={(item) => handleRefreshRow(item)}
                onRowMouseEnter={(event, item) => {
                    showTooltip({
                        cursorX: event.clientX,
                        cursorY: event.clientY,
                        imageAlt: item.title,
                        imageUrl: item.thumbnailUrl,
                    });
                }}
                onRowMouseLeave={hideTooltip}
                onRowMouseMove={(event, item) => {
                    if (!item.thumbnailUrl) {
                        return;
                    }

                    queueTooltipPositionUpdate(event.clientX, event.clientY);
                }}
                onSelectListing={(item) => {
                    hideTooltip();
                    setHistoryListing(item);
                }}
                refreshingById={refreshingById}
                resetKey={tableResetKey}
                scrollContainerRef={scrollViewportRef}
            />
        );
    }

    return (
        <div className="flex h-full flex-col">
            <ListingsControls
                favsRange={favsRange}
                isTracking={isTracking}
                listingInput={listingInput}
                onFavsRangeChange={setFavsRange}
                onListingInputChange={setListingInput}
                onPriceRangeChange={setPriceRange}
                onSearchChange={setSearch}
                onSubmit={handleTrack}
                onToggleDigitalListings={() => setShowDigitalListings((current) => !current)}
                onTogglePhysicalListings={() => setShowPhysicalListings((current) => !current)}
                priceRange={priceRange}
                search={search}
                showDigitalListings={showDigitalListings}
                showPhysicalListings={showPhysicalListings}
            />
            {errorMessage ? (
                <div className="border-terminal-red/20 border-b bg-terminal-red/10 px-3 py-2 text-terminal-red text-xs">
                    {errorMessage}
                </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-auto" ref={scrollViewportRef}>
                {listingsContent}
            </div>
            <MouseThumbnailTooltipPortal tooltip={tooltip} tooltipRef={tooltipRef} />
            <ListingHistoryDrawer
                onClose={() => setHistoryListing(null)}
                selectedListing={historyListing}
            />
        </div>
    );
}
