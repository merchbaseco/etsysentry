import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
    getDailyProductRanksForKeyword,
    type ListTrackedKeywordsOutput,
    listTrackedKeywords,
    trackKeyword,
    type DailyProductRanksForKeyword,
    type TrackedKeywordItem
} from '@/lib/keywords-api';
import {
    getKeywordRanksForProduct,
    type GetKeywordRanksForProductOutput
} from '@/lib/listings-api';
import { TrpcRequestError } from '@/lib/trpc-http';
import { queryClient, trpc } from '@/lib/trpc-client';
import { cn } from '@/lib/utils';
import {
    EmptyState,
    FilterChip,
    FilterGroup,
    StatusBadge,
    TopToolbar,
    timeAgo,
    timeUntil
} from '@/components/ui/dashboard';

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

const upsertById = (items: TrackedKeywordItem[], nextItem: TrackedKeywordItem): TrackedKeywordItem[] => {
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

export function KeywordsTab() {
    const cachedTrackedKeywords = queryClient.getQueryData<ListTrackedKeywordsOutput>(
        trackedKeywordsQueryKey
    );
    const initialItems = cachedTrackedKeywords?.items ?? [];

    const [search, setSearch] = useState('');
    const [trackingStateFilter, setTrackingStateFilter] = useState<
        'active' | 'paused' | 'error' | null
    >(null);
    const [items, setItems] = useState<TrackedKeywordItem[]>(() => initialItems);
    const [isLoading, setIsLoading] = useState(() => initialItems.length === 0);
    const [isTracking, setIsTracking] = useState(false);
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
        void loadKeywords();
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
            void loadKeywords();
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
                item.keyword.toLowerCase().includes(query) ||
                item.normalizedKeyword.includes(query)
            );
        });
    }, [items, search, trackingStateFilter]);

    const handleTrack = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!keywordInput.trim()) {
            return;
        }

        setIsTracking(true);

        try {
            const response = await trackKeyword({
                keyword: keywordInput
            });

            setItems((current) => {
                const nextItems = upsertById(current, response.item);

                queryClient.setQueryData<ListTrackedKeywordsOutput>(trackedKeywordsQueryKey, {
                    items: nextItems
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

    const loadLatestForKeyword = useCallback(async (trackedKeywordId: string) => {
        setIsLatestLoading(true);

        try {
            const dailyProductRanks = await getDailyProductRanksForKeyword({
                trackedKeywordId
            });

            setRanksByKeywordId((current) => ({
                ...current,
                [trackedKeywordId]: dailyProductRanks
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
                listing: listingId
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
        void loadLatestForKeyword(item.id);
    };

    const selectedKeyword = useMemo(
        () => items.find((item) => item.id === selectedKeywordId) ?? null,
        [items, selectedKeywordId]
    );
    const selectedDailyProductRanks = selectedKeywordId ? ranksByKeywordId[selectedKeywordId] : undefined;

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
                    value={keywordInput}
                    onChange={(event) => setKeywordInput(event.target.value)}
                    type="text"
                    placeholder='Enter Etsy keyword (for example: "mid century wall art")'
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
                    {isTracking ? 'Tracking...' : 'Track Keyword'}
                </button>
            </form>

            {errorMessage ? (
                <div className="border-b border-terminal-red/20 bg-terminal-red/10 px-3 py-2 text-xs text-terminal-red">
                    {errorMessage}
                </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto">
                {isLoading ? (
                    <div className="px-3 py-6 text-xs text-muted-foreground">Loading tracked keywords...</div>
                ) : filtered.length === 0 ? (
                    <EmptyState message="No tracked keywords yet. Add one above." />
                ) : (
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 z-10 bg-card">
                            <tr className="border-b border-border">
                                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Keyword
                                </th>
                                <th className="px-2 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
                                    State
                                </th>
                                <th className="px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Last Refreshed
                                </th>
                                <th className="px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Updated
                                </th>
                                <th className="px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Next Sync
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((item) => {
                                const isSyncInFlight = isKeywordSyncInFlight(item);

                                return (
                                    <tr
                                        key={item.id}
                                        className={cn(
                                            'cursor-pointer border-b border-border/50',
                                            selectedKeywordId === item.id ? 'bg-accent/30' : 'hover:bg-accent/20'
                                        )}
                                        onClick={() => handleSelectKeyword(item)}
                                    >
                                        <td className="px-3 py-1.5 text-foreground">
                                            <div className="font-medium">{item.keyword}</div>
                                            <div className="text-[11px] text-terminal-dim">
                                                {item.normalizedKeyword}
                                            </div>
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            <StatusBadge status={item.trackingState} />
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-terminal-dim">
                                            {timeAgo(item.lastRefreshedAt)}
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-terminal-dim">
                                            {timeAgo(item.updatedAt)}
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-terminal-dim">
                                            <div className="flex items-center justify-end gap-1">
                                                {isSyncInFlight ? (
                                                    <RefreshCw
                                                        aria-hidden="true"
                                                        className="size-3 animate-spin text-terminal-dim"
                                                    />
                                                ) : null}
                                                <span>{timeUntil(item.nextSyncAt)}</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {selectedKeyword ? (
                <div className="border-t border-border">
                    <div className="px-3 py-2 text-xs">
                        <div>
                            <span className="text-muted-foreground">Latest Rankings:</span>{' '}
                            <span className="font-medium text-foreground">{selectedKeyword.keyword}</span>
                            {selectedDailyProductRanks?.observedAt ? (
                                <span className="ml-2 text-[11px] text-terminal-dim">
                                    Captured {timeAgo(selectedDailyProductRanks.observedAt)}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <div className="max-h-72 overflow-auto border-t border-border/60">
                        {isLatestLoading ? (
                            <div className="px-3 py-4 text-xs text-muted-foreground">
                                Loading latest keyword ranks...
                            </div>
                        ) : !selectedDailyProductRanks || selectedDailyProductRanks.items.length === 0 ? (
                            <div className="px-3 py-4 text-xs text-muted-foreground">
                                No rank data captured yet for this keyword.
                            </div>
                        ) : (
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 z-10 bg-card">
                                    <tr className="border-b border-border">
                                        <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                                            Rank
                                        </th>
                                        <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                                            Listing Id
                                        </th>
                                        <th className="px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                                            Observed
                                        </th>
                                        <th className="px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                                            Product
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedDailyProductRanks.items.map((item) => (
                                        <tr key={`${item.trackedKeywordId}:${item.rank}`} className="border-b border-border/50">
                                            <td className="px-3 py-1.5 text-terminal-green">{item.rank}</td>
                                            <td className="px-2 py-1.5 font-mono text-[11px] text-terminal-dim">
                                                <a
                                                    href={`https://www.etsy.com/listing/${item.etsyListingId}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="hover:text-primary"
                                                >
                                                    {item.etsyListingId}
                                                </a>
                                            </td>
                                            <td className="px-2 py-1.5 text-right text-terminal-dim">
                                                {timeAgo(item.observedAt)}
                                            </td>
                                            <td className="px-2 py-1.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => void loadReverseKeywords(item.etsyListingId)}
                                                    className={cn(
                                                        'h-7 rounded border border-border bg-secondary px-2 text-[11px] uppercase tracking-wider',
                                                        'transition-colors hover:text-foreground'
                                                    )}
                                                >
                                                    Keywords
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {selectedListingId ? (
                        <div className="border-t border-border px-3 py-2 text-xs">
                            <div className="mb-2 text-muted-foreground">
                                Daily keyword ranks for product{' '}
                                <span className="font-mono text-foreground">{selectedListingId}</span>
                            </div>
                            {isReverseLoading ? (
                                <div className="text-muted-foreground">Loading keyword appearances...</div>
                            ) : !keywordRanksForProduct || keywordRanksForProduct.items.length === 0 ? (
                                <div className="text-muted-foreground">
                                    This listing has not appeared in tracked keyword captures yet.
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {keywordRanksForProduct.items.map((item) => (
                                        <div
                                            key={`${item.trackedKeywordId}:${item.latestObservedAt}`}
                                            className="flex items-center justify-between rounded border border-border/60 px-2 py-1.5"
                                        >
                                            <span className="text-foreground">{item.keyword}</span>
                                            <span className="text-terminal-dim">
                                                current #{item.currentRank} | best #{item.bestRank} | days{' '}
                                                {item.daysSeen}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
