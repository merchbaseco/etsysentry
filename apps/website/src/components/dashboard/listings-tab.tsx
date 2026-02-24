import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    type ListTrackedListingsOutput,
    listTrackedListings,
    refreshTrackedListing,
    trackListing,
    type TrackedListingItem
} from '@/lib/listings-api';
import { listingsInvalidatedEventName } from '@/hooks/use-realtime-query-invalidations';
import { queryClient, trpc } from '@/lib/trpc-client';
import {
    captureScrollAnchor,
    restoreScrollAnchor
} from '@/lib/scroll-anchor';
import { EmptyState } from '@/components/ui/dashboard';
import { ListingsControls } from './listings-controls';
import { ListingsTable } from './listings-table';
import {
    mergeTrackedListings,
    toListingsErrorMessage,
    upsertListingById,
    isListingSyncInFlight
} from './listings-tab-utils';
import {
    MouseThumbnailTooltipPortal,
    useMouseThumbnailTooltip
} from './mouse-thumbnail-tooltip';
import { ListingHistoryDrawer } from './listing-history-drawer';

const trackedListingsQueryKey = trpc.app.listings.list.queryOptions({}).queryKey;
const REALTIME_REFRESH_DEBOUNCE_MS = 200;

export function ListingsTab() {
    const cachedTrackedListings = queryClient.getQueryData<ListTrackedListingsOutput>(
        trackedListingsQueryKey
    );
    const initialItems = cachedTrackedListings?.items ?? [];

    const [search, setSearch] = useState('');
    const [showDigitalListings, setShowDigitalListings] = useState(false);
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 40]);
    const [favsRange, setFavsRange] = useState<[number, number]>([0, 5000]);
    const [items, setItems] = useState<TrackedListingItem[]>(() => initialItems);
    const [isLoading, setIsLoading] = useState(() => initialItems.length === 0);
    const [isTracking, setIsTracking] = useState(false);
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
                items: nextItems
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

    const loadListings = useCallback(async (options?: { preserveScroll?: boolean }) => {
        try {
            const response = await listTrackedListings({});
            const mergedItems = mergeTrackedListings(itemsRef.current, response.items);

            applyListings(mergedItems, options);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toListingsErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    }, [applyListings]);

    useEffect(() => {
        void loadListings();
    }, [loadListings]);

    useEffect(() => {
        const onListingsInvalidated = () => {
            if (realtimeRefreshTimeoutRef.current !== null) {
                return;
            }

            realtimeRefreshTimeoutRef.current = window.setTimeout(() => {
                realtimeRefreshTimeoutRef.current = null;
                void loadListings({
                    preserveScroll: true
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
    }, [loadListings]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        const priceActive = priceRange[0] > 0 || priceRange[1] < 40;
        const favsActive = favsRange[0] > 0 || favsRange[1] < 5000;

        return items.filter((item) => {
            if (!showDigitalListings && item.isDigital) {
                return false;
            }

            if (priceActive) {
                const price = item.price?.value ?? null;
                if (price === null || price < priceRange[0] || price > priceRange[1]) {
                    return false;
                }
            }

            if (favsActive) {
                if (item.numFavorers === null || item.numFavorers < favsRange[0] || item.numFavorers > favsRange[1]) {
                    return false;
                }
            }

            if (query.length === 0) {
                return true;
            }

            return (
                item.title.toLowerCase().includes(query) ||
                item.etsyListingId.includes(query) ||
                (item.shopName ?? '').toLowerCase().includes(query) ||
                (item.shopId ?? '').includes(query)
            );
        });
    }, [favsRange, items, priceRange, search, showDigitalListings]);

    const handleTrack = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!listingInput.trim()) {
            return;
        }

        setIsTracking(true);

        try {
            const response = await trackListing({
                listing: listingInput
            });

            const nextItems = upsertListingById(itemsRef.current, response.item);
            applyListings(nextItems);
            setListingInput('');
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toListingsErrorMessage(error));
        } finally {
            setIsTracking(false);
        }
    };

    const handleRefreshRow = async (item: TrackedListingItem) => {
        if (isListingSyncInFlight(item) || refreshingById[item.id] === true) {
            return;
        }

        setRefreshingById((current) => ({
            ...current,
            [item.id]: true
        }));

        try {
            const refreshed = await refreshTrackedListing({
                trackedListingId: item.id
            });

            const nextItems = upsertListingById(itemsRef.current, refreshed);
            applyListings(nextItems);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toListingsErrorMessage(error));
            void loadListings();
        } finally {
            setRefreshingById((current) => ({
                ...current,
                [item.id]: false
            }));
        }
    };

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
                onToggleShowDigital={() => setShowDigitalListings((current) => !current)}
                priceRange={priceRange}
                search={search}
                showDigitalListings={showDigitalListings}
            />

            {errorMessage ? (
                <div className="border-b border-terminal-red/20 bg-terminal-red/10 px-3 py-2 text-xs text-terminal-red">
                    {errorMessage}
                </div>
            ) : null}

            <div ref={scrollViewportRef} className="min-h-0 flex-1 overflow-auto">
                {isLoading ? (
                    <div className="px-3 py-6 text-xs text-muted-foreground">Loading tracked listings...</div>
                ) : filtered.length === 0 ? (
                    <EmptyState message="No tracked listings yet. Add one with an Etsy URL above." />
                ) : (
                    <ListingsTable
                        items={filtered}
                        refreshingById={refreshingById}
                        onOpenHistory={setHistoryListing}
                        onRefresh={(item) => void handleRefreshRow(item)}
                        onRowMouseEnter={(event, item) => {
                            showTooltip({
                                cursorX: event.clientX,
                                cursorY: event.clientY,
                                imageAlt: item.title,
                                imageUrl: item.thumbnailUrl
                            });
                        }}
                        onRowMouseMove={(event, item) => {
                            if (!item.thumbnailUrl) {
                                return;
                            }

                            queueTooltipPositionUpdate(event.clientX, event.clientY);
                        }}
                        onRowMouseLeave={hideTooltip}
                    />
                )}
            </div>
            <MouseThumbnailTooltipPortal tooltip={tooltip} tooltipRef={tooltipRef} />
            <ListingHistoryDrawer
                selectedListing={historyListing}
                onClose={() => setHistoryListing(null)}
            />
        </div>
    );
}
