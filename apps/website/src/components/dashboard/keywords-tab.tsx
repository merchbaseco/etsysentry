import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toKeywordActivityPath } from '@/components/dashboard/keyword-activity-tabs-state';
import { EmptyState, FilterChip, FilterGroup, TopToolbar } from '@/components/ui/dashboard';
import { useRefreshTrackedKeyword } from '@/hooks/use-refresh-tracked-keyword';
import { useTrackKeyword } from '@/hooks/use-track-keyword';
import { useTrackedKeywords } from '@/hooks/use-tracked-keywords';
import type { ListTrackedKeywordsOutput, TrackedKeywordItem } from '@/lib/keywords-api';
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

export function KeywordsTab() {
    const navigate = useNavigate();
    const cachedTrackedKeywords =
        queryClient.getQueryData<ListTrackedKeywordsOutput>(trackedKeywordsQueryKey);
    const initialItems = cachedTrackedKeywords?.items ?? [];
    const trackedKeywordsQuery = useTrackedKeywords(
        {},
        {
            enabled: false,
        }
    );
    const trackKeywordMutation = useTrackKeyword();
    const refreshTrackedKeywordMutation = useRefreshTrackedKeyword();
    const refetchTrackedKeywords = trackedKeywordsQuery.refetch;

    const [search, setSearch] = useState('');
    const [trackingStateFilter, setTrackingStateFilter] = useState<
        'active' | 'paused' | 'error' | null
    >(null);
    const [items, setItems] = useState<TrackedKeywordItem[]>(() => initialItems);
    const [isLoading, setIsLoading] = useState(() => initialItems.length === 0);
    const [refreshingById, setRefreshingById] = useState<Record<string, boolean>>({});
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [keywordInput, setKeywordInput] = useState('');
    const scrollViewportRef = useRef<HTMLDivElement | null>(null);

    const loadKeywords = useCallback(async () => {
        try {
            const result = await refetchTrackedKeywords();
            const response = result.data;

            if (!response) {
                throw result.error ?? new Error('Failed to load tracked keywords.');
            }

            setItems(response.items);
            queryClient.setQueryData(trackedKeywordsQueryKey, response);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    }, [refetchTrackedKeywords]);

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

        try {
            const response = await trackKeywordMutation.mutateAsync({
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
        }
    };

    const handleRefreshRow = async (item: TrackedKeywordItem): Promise<void> => {
        if (isKeywordSyncInFlight(item) || refreshingById[item.id] === true) {
            return;
        }

        setRefreshingById((current) => ({ ...current, [item.id]: true }));

        try {
            const refreshed = await refreshTrackedKeywordMutation.mutateAsync({
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

    const isTracking = trackKeywordMutation.isPending;

    let keywordsContent: ReactNode;
    if (isLoading) {
        keywordsContent = (
            <div className="px-3 py-6 text-muted-foreground text-xs">
                Loading tracked keywords...
            </div>
        );
    } else if (filtered.length === 0) {
        keywordsContent = <EmptyState message="No tracked keywords yet. Add one above." />;
    } else {
        keywordsContent = (
            <KeywordsTable
                items={filtered}
                onOpenActivity={(item) => {
                    navigate(toKeywordActivityPath(item.id), {
                        state: {
                            keyword: item.keyword,
                            trackedKeywordId: item.id,
                        },
                    });
                }}
                onRefresh={(item) => handleRefreshRow(item)}
                refreshingById={refreshingById}
                resetKey={tableResetKey}
                scrollContainerRef={scrollViewportRef}
            />
        );
    }

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
                <div className="border-terminal-red/20 border-y bg-terminal-red/10 px-3 py-2 text-terminal-red text-xs">
                    {errorMessage}
                </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto" ref={scrollViewportRef}>
                {keywordsContent}
            </div>
        </div>
    );
}
