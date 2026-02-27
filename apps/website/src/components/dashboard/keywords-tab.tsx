import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    EmptyState,
    FilterChip,
    FilterGroup,
    TopToolbar,
    timeAgo,
} from '@/components/ui/dashboard';
import {
    type DailyProductRanksForKeyword,
    getDailyProductRanksForKeyword,
    type ListTrackedKeywordsOutput,
    listTrackedKeywords,
    refreshTrackedKeyword,
    type TrackedKeywordItem,
    trackKeyword,
} from '@/lib/keywords-api';
import {
    type GetKeywordRanksForProductOutput,
    getKeywordRanksForProduct,
} from '@/lib/listings-api';
import { queryClient, trpc } from '@/lib/trpc-client';
import { TrpcRequestError } from '@/lib/trpc-http';
import { cn } from '@/lib/utils';
import { KeywordsTable } from './keywords-table';

const trackedKeywordsQueryKey = trpc.app.keywords.list.queryOptions({}).queryKey;
const trackedKeywordsQueryKeyJson = JSON.stringify(trackedKeywordsQueryKey);

const toErrorMessage = (error: unknown): string => {
    if (error instanceof TrpcRequestError) {
        return error.message;
    }

    if (error instanceof Error && error.message.length > 0) {
        return error.message;
    }

    return 'Unexpected request failure.';
};

const upsertById = (
    items: TrackedKeywordItem[],
    nextItem: TrackedKeywordItem
): TrackedKeywordItem[] => {
    const existingIndex = items.findIndex((item) => item.id === nextItem.id);

    if (existingIndex === -1) {
        return [nextItem, ...items];
    }

    const clone = [...items];
    clone[existingIndex] = nextItem;

    return clone;
};

const isKeywordSyncInFlight = (item: TrackedKeywordItem): boolean => {
    return item.syncState === 'queued' || item.syncState === 'syncing';
};

const renderKeywordsContent = (params: {
    filtered: TrackedKeywordItem[];
    isLoading: boolean;
    onRefresh: (item: TrackedKeywordItem) => Promise<void>;
    onSelectKeyword: (item: TrackedKeywordItem) => void;
    refreshingById: Record<string, boolean>;
    resetKey: string;
    scrollViewportRef: { current: HTMLDivElement | null };
    selectedKeywordId: string | null;
}): ReactNode => {
    if (params.isLoading) {
        return (
            <div className="px-3 py-6 text-muted-foreground text-xs">
                Loading tracked keywords...
            </div>
        );
    }

    if (params.filtered.length === 0) {
        return <EmptyState message="No tracked keywords yet. Add one above." />;
    }

    return (
        <KeywordsTable
            items={params.filtered}
            onRefresh={(item) => params.onRefresh(item)}
            onSelectKeyword={params.onSelectKeyword}
            refreshingById={params.refreshingById}
            resetKey={params.resetKey}
            scrollContainerRef={params.scrollViewportRef}
            selectedKeywordId={params.selectedKeywordId}
        />
    );
};

const renderLatestRanksContent = (params: {
    isLatestLoading: boolean;
    loadReverseKeywords: (listingId: string) => Promise<void>;
    selectedDailyProductRanks: DailyProductRanksForKeyword | undefined;
}): ReactNode => {
    if (params.isLatestLoading) {
        return (
            <div className="px-3 py-4 text-muted-foreground text-xs">
                Loading latest keyword ranks...
            </div>
        );
    }

    if (params.selectedDailyProductRanks && params.selectedDailyProductRanks.items.length > 0) {
        return (
            <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-border border-b">
                        <th className="px-3 py-2 text-left text-[10px] text-muted-foreground uppercase tracking-wider">
                            Rank
                        </th>
                        <th className="px-2 py-2 text-left text-[10px] text-muted-foreground uppercase tracking-wider">
                            Listing Id
                        </th>
                        <th className="px-2 py-2 text-right text-[10px] text-muted-foreground uppercase tracking-wider">
                            Observed
                        </th>
                        <th className="px-2 py-2 text-right text-[10px] text-muted-foreground uppercase tracking-wider">
                            Product
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {params.selectedDailyProductRanks.items.map((item) => (
                        <tr
                            className="border-border/50 border-b"
                            key={`${item.trackedKeywordId}:${item.rank}`}
                        >
                            <td className="px-3 py-1.5 text-terminal-green">{item.rank}</td>
                            <td className="px-2 py-1.5 font-mono text-[11px] text-terminal-dim">
                                <a
                                    className="hover:text-primary"
                                    href={`https://www.etsy.com/listing/${item.etsyListingId}`}
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    {item.etsyListingId}
                                </a>
                            </td>
                            <td className="px-2 py-1.5 text-right text-terminal-dim">
                                {timeAgo(item.observedAt)}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                                <button
                                    className={cn(
                                        'h-7 rounded border border-border bg-secondary px-2 text-[11px] uppercase tracking-wider',
                                        'transition-colors hover:text-foreground'
                                    )}
                                    onClick={() => params.loadReverseKeywords(item.etsyListingId)}
                                    type="button"
                                >
                                    Keywords
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    return (
        <div className="px-3 py-4 text-muted-foreground text-xs">
            No rank data captured yet for this keyword.
        </div>
    );
};

const renderReverseKeywordContent = (params: {
    isReverseLoading: boolean;
    keywordRanksForProduct: GetKeywordRanksForProductOutput | null;
}): ReactNode => {
    if (params.isReverseLoading) {
        return <div className="text-muted-foreground">Loading keyword appearances...</div>;
    }

    if (params.keywordRanksForProduct && params.keywordRanksForProduct.items.length > 0) {
        return (
            <div className="space-y-1">
                {params.keywordRanksForProduct.items.map((item) => (
                    <div
                        className="flex items-center justify-between rounded border border-border/60 px-2 py-1.5"
                        key={`${item.trackedKeywordId}:${item.latestObservedAt}`}
                    >
                        <span className="text-foreground">{item.keyword}</span>
                        <span className="text-terminal-dim">
                            current #{item.currentRank} | best #{item.bestRank} | days{' '}
                            {item.daysSeen}
                        </span>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="text-muted-foreground">
            This listing has not appeared in tracked keyword captures yet.
        </div>
    );
};

export function KeywordsTab() {
    const cachedTrackedKeywords =
        queryClient.getQueryData<ListTrackedKeywordsOutput>(trackedKeywordsQueryKey);
    const initialItems = cachedTrackedKeywords?.items ?? [];

    const [search, setSearch] = useState('');
    const [trackingStateFilter, setTrackingStateFilter] = useState<
        'active' | 'paused' | 'error' | null
    >(null);
    const [items, setItems] = useState<TrackedKeywordItem[]>(() => initialItems);
    const [isLoading, setIsLoading] = useState(() => initialItems.length === 0);
    const [isTracking, setIsTracking] = useState(false);
    const [refreshingById, setRefreshingById] = useState<Record<string, boolean>>({});
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [keywordInput, setKeywordInput] = useState('');
    const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);
    const [isLatestLoading, setIsLatestLoading] = useState(false);
    const [ranksByKeywordId, setRanksByKeywordId] = useState<
        Record<string, DailyProductRanksForKeyword>
    >({});
    const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
    const [keywordRanksForProduct, setKeywordRanksForProduct] =
        useState<GetKeywordRanksForProductOutput | null>(null);
    const [isReverseLoading, setIsReverseLoading] = useState(false);
    const [, setClockTick] = useState(0);
    const scrollViewportRef = useRef<HTMLDivElement | null>(null);

    const loadKeywords = useCallback(async () => {
        try {
            const response = await listTrackedKeywords({});

            setItems(response.items);
            queryClient.setQueryData(trackedKeywordsQueryKey, response);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadKeywords();
    }, [loadKeywords]);

    useEffect(() => {
        return queryClient.getQueryCache().subscribe((event) => {
            if (JSON.stringify(event.query.queryKey) !== trackedKeywordsQueryKeyJson) {
                return;
            }

            const data = event.query.state.data as ListTrackedKeywordsOutput | undefined;

            if (!data) {
                return;
            }

            setItems(data.items);
            setIsLoading(false);
        });
    }, []);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setClockTick((current) => current + 1);
        }, 30_000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            loadKeywords();
        }, 60_000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [loadKeywords]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        return items.filter((item) => {
            if (trackingStateFilter && item.trackingState !== trackingStateFilter) {
                return false;
            }

            if (query.length === 0) {
                return true;
            }

            return (
                item.keyword.toLowerCase().includes(query) || item.normalizedKeyword.includes(query)
            );
        });
    }, [items, search, trackingStateFilter]);
    const tableResetKey = `${search}|${trackingStateFilter ?? 'all'}`;

    useEffect(() => {
        scrollViewportRef.current?.scrollTo({
            top: 0,
        });
    }, []);

    const handleTrack = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!keywordInput.trim()) {
            return;
        }

        setIsTracking(true);

        try {
            const response = await trackKeyword({
                keyword: keywordInput,
            });

            setItems((current) => {
                const nextItems = upsertById(current, response.item);

                queryClient.setQueryData<ListTrackedKeywordsOutput>(trackedKeywordsQueryKey, {
                    items: nextItems,
                });

                return nextItems;
            });
            setKeywordInput('');
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
        } finally {
            setIsTracking(false);
        }
    };

    const handleRefreshRow = async (item: TrackedKeywordItem): Promise<void> => {
        if (isKeywordSyncInFlight(item) || refreshingById[item.id] === true) {
            return;
        }

        setRefreshingById((current) => ({ ...current, [item.id]: true }));

        try {
            const refreshed = await refreshTrackedKeyword({
                trackedKeywordId: item.id,
            });

            setItems((current) => {
                const nextItems = upsertById(current, refreshed);
                queryClient.setQueryData<ListTrackedKeywordsOutput>(trackedKeywordsQueryKey, {
                    items: nextItems,
                });
                return nextItems;
            });
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
            loadKeywords();
        } finally {
            setRefreshingById((current) => ({ ...current, [item.id]: false }));
        }
    };

    const loadLatestForKeyword = useCallback(async (trackedKeywordId: string) => {
        setIsLatestLoading(true);

        try {
            const dailyProductRanks = await getDailyProductRanksForKeyword({
                trackedKeywordId,
            });

            setRanksByKeywordId((current) => ({
                ...current,
                [trackedKeywordId]: dailyProductRanks,
            }));
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
        } finally {
            setIsLatestLoading(false);
        }
    }, []);

    const loadReverseKeywords = useCallback(async (listingId: string) => {
        setIsReverseLoading(true);
        setSelectedListingId(listingId);

        try {
            const response = await getKeywordRanksForProduct({
                listing: listingId,
            });
            setKeywordRanksForProduct(response);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
        } finally {
            setIsReverseLoading(false);
        }
    }, []);

    const handleSelectKeyword = (item: TrackedKeywordItem) => {
        setSelectedKeywordId(item.id);
        setSelectedListingId(null);
        setKeywordRanksForProduct(null);
        loadLatestForKeyword(item.id);
    };

    const selectedKeyword = useMemo(
        () => items.find((item) => item.id === selectedKeywordId) ?? null,
        [items, selectedKeywordId]
    );
    const selectedDailyProductRanks = selectedKeywordId
        ? ranksByKeywordId[selectedKeywordId]
        : undefined;
    const keywordsContent = renderKeywordsContent({
        filtered,
        isLoading,
        onRefresh: handleRefreshRow,
        onSelectKeyword: handleSelectKeyword,
        refreshingById,
        resetKey: tableResetKey,
        scrollViewportRef,
        selectedKeywordId,
    });
    const latestRanksContent = renderLatestRanksContent({
        isLatestLoading,
        loadReverseKeywords,
        selectedDailyProductRanks,
    });
    const reverseKeywordContent = renderReverseKeywordContent({
        isReverseLoading,
        keywordRanksForProduct,
    });

    return (
        <div className="flex h-full flex-col">
            <TopToolbar onSearchChange={setSearch} search={search}>
                <FilterGroup label="Tracking">
                    {(['active', 'paused', 'error'] as const).map((stateValue) => (
                        <FilterChip
                            active={trackingStateFilter === stateValue}
                            key={stateValue}
                            label={stateValue}
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
                className="flex items-center gap-2 border-border border-b px-3 py-2 text-xs"
                onSubmit={handleTrack}
            >
                <input
                    className="h-8 flex-1 rounded border border-border bg-secondary px-2 text-xs outline-none placeholder:text-muted-foreground"
                    onChange={(event) => setKeywordInput(event.target.value)}
                    placeholder='Enter Etsy keyword (for example: "mid century wall art")'
                    type="text"
                    value={keywordInput}
                />
                <button
                    className={cn(
                        'h-8 rounded border border-border bg-secondary px-3 text-[11px] uppercase tracking-wider transition-colors',
                        'disabled:cursor-default disabled:opacity-50',
                        'hover:text-foreground'
                    )}
                    disabled={isTracking}
                    type="submit"
                >
                    {isTracking ? 'Tracking...' : 'Track Keyword'}
                </button>
            </form>

            {errorMessage ? (
                <div className="border-terminal-red/20 border-b bg-terminal-red/10 px-3 py-2 text-terminal-red text-xs">
                    {errorMessage}
                </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto" ref={scrollViewportRef}>
                {keywordsContent}
            </div>

            {selectedKeyword ? (
                <div className="border-border border-t">
                    <div className="px-3 py-2 text-xs">
                        <div>
                            <span className="text-muted-foreground">Latest Rankings:</span>{' '}
                            <span className="font-medium text-foreground">
                                {selectedKeyword.keyword}
                            </span>
                            {selectedDailyProductRanks?.observedAt ? (
                                <span className="ml-2 text-[11px] text-terminal-dim">
                                    Captured {timeAgo(selectedDailyProductRanks.observedAt)}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <div className="max-h-72 overflow-auto border-border/60 border-t">
                        {latestRanksContent}
                    </div>

                    {selectedListingId ? (
                        <div className="border-border border-t px-3 py-2 text-xs">
                            <div className="mb-2 text-muted-foreground">
                                Daily keyword ranks for product{' '}
                                <span className="font-mono text-foreground">
                                    {selectedListingId}
                                </span>
                            </div>
                            {reverseKeywordContent}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
