import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
    type KeywordActivityListingRow,
    KeywordActivityListingsContent,
} from '@/components/dashboard/keyword-activity-listings-content';
import { ListingHistoryDrawer } from '@/components/dashboard/listing-history-drawer';
import {
    isListingSyncInFlight,
    toListingsErrorMessage,
} from '@/components/dashboard/listings-tab-utils';
import { StatusBadge, timeAgo, timeUntil } from '@/components/ui/dashboard';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useKeywordActivity } from '@/hooks/use-keyword-activity';
import { useRefreshTrackedListing } from '@/hooks/use-refresh-tracked-listing';
import {
    DAYS_OPTIONS,
    DEFAULT_KEYWORD_ACTIVITY_DAYS,
    isKeywordActivityTabState,
    type KeywordActivityDaysOption,
    toKeywordActivityPrimaryErrorMessage,
    toKeywordActivitySummary,
    toKeywordActivityTitle,
} from './keyword-activity-tab-utils';

export function KeywordActivityTab() {
    const { trackedKeywordId } = useParams<{ trackedKeywordId: string }>();
    const location = useLocation();
    const locationState = isKeywordActivityTabState(location.state) ? location.state : undefined;
    const [days, setDays] = useState<KeywordActivityDaysOption>(DEFAULT_KEYWORD_ACTIVITY_DAYS);
    const [refreshingById, setRefreshingById] = useState<Record<string, boolean>>({});
    const [historyListing, setHistoryListing] = useState<
        KeywordActivityListingRow['listing'] | null
    >(null);
    const [refreshErrorMessage, setRefreshErrorMessage] = useState<string | null>(null);
    const scrollViewportRef = useRef<HTMLDivElement | null>(null);

    const normalizedTrackedKeywordId = trackedKeywordId?.trim() ?? '';
    const hasTrackedKeywordId = normalizedTrackedKeywordId.length > 0;
    const keywordActivityQuery = useKeywordActivity(
        {
            days,
            trackedKeywordId: normalizedTrackedKeywordId,
        },
        {
            enabled: hasTrackedKeywordId,
        }
    );
    const refreshTrackedListingMutation = useRefreshTrackedListing();

    const activity = keywordActivityQuery.data ?? null;
    const keywordTitle = toKeywordActivityTitle({
        activityKeyword: activity?.keyword.keyword,
        locationKeyword: locationState?.keyword,
        trackedKeywordId,
    });

    const rankedListingRows = useMemo(() => activity?.items ?? [], [activity?.items]);
    const summary = useMemo(() => toKeywordActivitySummary(activity?.items), [activity?.items]);

    useEffect(() => {
        if (!historyListing) {
            return;
        }

        const nextHistoryListing =
            rankedListingRows.find((item) => item.listing.id === historyListing.id)?.listing ??
            null;

        if (!nextHistoryListing) {
            setHistoryListing(null);
            return;
        }

        if (nextHistoryListing !== historyListing) {
            setHistoryListing(nextHistoryListing);
        }
    }, [historyListing, rankedListingRows]);

    const handleRefreshRow = useCallback(
        async (item: KeywordActivityListingRow['listing']) => {
            if (isListingSyncInFlight(item) || refreshingById[item.id] === true) {
                return;
            }

            setRefreshingById((current) => ({
                ...current,
                [item.id]: true,
            }));

            try {
                await refreshTrackedListingMutation.mutateAsync({
                    trackedListingId: item.id,
                });

                await keywordActivityQuery.refetch();
                setRefreshErrorMessage(null);
            } catch (error) {
                setRefreshErrorMessage(toListingsErrorMessage(error));
            } finally {
                setRefreshingById((current) => ({
                    ...current,
                    [item.id]: false,
                }));
            }
        },
        [keywordActivityQuery, refreshTrackedListingMutation, refreshingById]
    );

    const keywordErrorMessage = toKeywordActivityPrimaryErrorMessage({
        error: keywordActivityQuery.error,
        hasTrackedKeywordId,
    });

    const isLoadingKeyword = hasTrackedKeywordId && keywordActivityQuery.isPending;

    return (
        <div className="flex h-full flex-col">
            <div className="border-border border-b px-3 py-2.5">
                <div className="flex items-center justify-between gap-4">
                    <h2 className="min-w-0 truncate font-semibold text-sm tracking-wide">
                        {keywordTitle}
                    </h2>
                    <div className="flex shrink-0 items-center gap-1.5">
                        <StatusBadge status={activity?.keyword.trackingState ?? 'pending'} />
                        <StatusBadge status={activity?.keyword.syncState ?? 'pending'} />
                        <Select
                            onValueChange={(value) =>
                                setDays(Number(value) as KeywordActivityDaysOption)
                            }
                            value={`${days}`}
                        >
                            <SelectTrigger
                                className="h-7 gap-1 rounded border-none bg-secondary px-1.5 py-0 text-[11px] shadow-none"
                                size="sm"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DAYS_OPTIONS.map((option) => (
                                    <SelectItem
                                        className="text-xs"
                                        key={option}
                                        value={`${option}`}
                                    >
                                        {option} days
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>{summary.rankedCount} products ranked</span>
                    <span className="mx-1.5 text-border">·</span>
                    <span>avg #{summary.avgRank}</span>
                    <span className="mx-1.5 text-border">·</span>
                    <span>
                        {activity?.capturedAt
                            ? `captured ${timeAgo(activity.capturedAt)}`
                            : 'no captures yet'}
                    </span>
                    {activity?.keyword.lastRefreshedAt ? (
                        <>
                            <span className="mx-1.5 text-border">·</span>
                            <span>synced {timeAgo(activity.keyword.lastRefreshedAt)}</span>
                        </>
                    ) : null}
                    {activity?.keyword.nextSyncAt ? (
                        <>
                            <span className="mx-1.5 text-border">·</span>
                            <span>next {timeUntil(activity.keyword.nextSyncAt)}</span>
                        </>
                    ) : null}
                </div>
            </div>

            {keywordErrorMessage ? (
                <div className="border-terminal-red/20 border-y bg-terminal-red/10 px-3 py-2 text-terminal-red text-xs">
                    {keywordErrorMessage}
                </div>
            ) : null}
            {refreshErrorMessage ? (
                <div className="border-terminal-red/20 border-y bg-terminal-red/10 px-3 py-2 text-terminal-red text-xs">
                    {refreshErrorMessage}
                </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto" ref={scrollViewportRef}>
                <KeywordActivityListingsContent
                    isLoading={isLoadingKeyword}
                    onRefresh={handleRefreshRow}
                    onSelectListing={setHistoryListing}
                    refreshingById={refreshingById}
                    rows={rankedListingRows}
                />
            </div>

            {rankedListingRows.length > 0 ? (
                <div className="border-border border-t px-3 py-2 text-[10px] text-muted-foreground">
                    {rankedListingRows.length}{' '}
                    {rankedListingRows.length === 1 ? 'listing' : 'listings'} ranked
                </div>
            ) : null}

            <ListingHistoryDrawer
                onClose={() => setHistoryListing(null)}
                selectedListing={historyListing}
            />
        </div>
    );
}
