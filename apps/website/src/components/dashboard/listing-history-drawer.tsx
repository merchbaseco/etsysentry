import { useCallback, useEffect, useState } from 'react';
import {
    type GetTrackedListingMetricHistoryOutput,
    getTrackedListingMetricHistory,
    type TrackedListingItem
} from '@/lib/listings-api';
import { TrpcRequestError } from '@/lib/trpc-http';
import { Button } from '@/components/ui/button';
import { DetailPanel, DetailRow, formatNumber, timeAgo } from '@/components/ui/dashboard';
import { ListingDetailsSection } from './listing-details-section';

const HISTORY_WINDOW_DAYS = 90;
const tableHeaderCellClassName =
    'px-3 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground';
const tableHeaderLeftCellClassName =
    'px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground';
const panelMessageClassName = 'rounded border border-border bg-secondary px-3 py-4 text-xs';
const errorPanelClassName = [
    'space-y-3 rounded border border-terminal-red/20',
    'bg-terminal-red/10 p-3'
].join(' ');
const sectionTitleClassName =
    'mb-2 text-[10px] uppercase tracking-wider text-muted-foreground';

const toErrorMessage = (error: unknown): string => {
    if (error instanceof TrpcRequestError) {
        return error.message;
    }

    if (error instanceof Error && error.message.length > 0) {
        return error.message;
    }

    return 'Unable to load listing history.';
};

const formatPrice = (
    price: GetTrackedListingMetricHistoryOutput['items'][number]['price']
): string => {
    if (!price) {
        return '--';
    }

    const nativeValue = (price.value || 0).toFixed(2);

    if (price.currencyCode === 'USD') {
        return `$${nativeValue}`;
    }

    return `${price.currencyCode} ${nativeValue}`;
};

const formatObservedDate = (observedDate: string): string => {
    return new Date(`${observedDate}T00:00:00.000Z`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
    });
};

export function ListingHistoryDrawer({
    selectedListing,
    onClose
}: {
    selectedListing: TrackedListingItem | null;
    onClose: () => void;
}) {
    const [history, setHistory] = useState<GetTrackedListingMetricHistoryOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const loadHistory = useCallback(async (trackedListingId: string) => {
        setIsLoading(true);

        try {
            const response = await getTrackedListingMetricHistory({
                trackedListingId,
                days: HISTORY_WINDOW_DAYS
            });

            setHistory(response);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!selectedListing) {
            setHistory(null);
            setErrorMessage(null);
            setIsLoading(false);
            return;
        }

        let isCurrent = true;

        setIsLoading(true);

        void getTrackedListingMetricHistory({
            trackedListingId: selectedListing.id,
            days: HISTORY_WINDOW_DAYS
        })
            .then((response) => {
                if (!isCurrent) {
                    return;
                }

                setHistory(response);
                setErrorMessage(null);
            })
            .catch((error) => {
                if (!isCurrent) {
                    return;
                }

                setErrorMessage(toErrorMessage(error));
            })
            .finally(() => {
                if (!isCurrent) {
                    return;
                }

                setIsLoading(false);
            });

        return () => {
            isCurrent = false;
        };
    }, [selectedListing]);

    const historyItems = history?.items ?? [];
    const latestSample = historyItems[0] ?? null;

    return (
        <DetailPanel
            open={Boolean(selectedListing)}
            onClose={onClose}
            title={selectedListing?.title ?? ''}
            subtitle={selectedListing?.etsyListingId}
        >
            {selectedListing ? (
                <>
                    <ListingDetailsSection item={selectedListing} />

                    <div>
                        <h4 className={sectionTitleClassName}>History Summary</h4>
                        <div className="space-y-0">
                            <DetailRow
                                label="Window"
                                value={`${history?.days ?? HISTORY_WINDOW_DAYS}d`}
                            />
                            <DetailRow label="Samples" value={historyItems.length} />
                            <DetailRow
                                label="Latest"
                                value={latestSample ? timeAgo(latestSample.observedAt) : '--'}
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className={`${panelMessageClassName} text-muted-foreground`}>
                            Loading daily history...
                        </div>
                    ) : errorMessage ? (
                        <div className={errorPanelClassName}>
                            <p className="text-xs text-terminal-red">{errorMessage}</p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void loadHistory(selectedListing.id)}
                            >
                                Retry
                            </Button>
                        </div>
                    ) : historyItems.length === 0 ? (
                        <div className={`${panelMessageClassName} text-muted-foreground`}>
                            No history captured yet.
                        </div>
                    ) : (
                        <div>
                            <h4 className={sectionTitleClassName}>Daily History</h4>
                            <div className="overflow-hidden rounded border border-border">
                                <table className="w-full text-xs">
                                    <thead className="bg-secondary/70">
                                        <tr className="border-b border-border/70">
                                            <th className={tableHeaderLeftCellClassName}>
                                                Day (UTC)
                                            </th>
                                            <th className={tableHeaderCellClassName}>Views</th>
                                            <th className={tableHeaderCellClassName}>Favs</th>
                                            <th className={tableHeaderCellClassName}>Qty</th>
                                            <th className={tableHeaderCellClassName}>Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historyItems.map((item) => (
                                            <tr
                                                key={item.observedDate}
                                                className='border-b border-border/50 last:border-b-0'
                                            >
                                                <td className="px-3 py-2 font-mono text-[11px]">
                                                    {formatObservedDate(item.observedDate)}
                                                </td>
                                                <td
                                                    className='px-3 py-2 text-right text-terminal-dim'
                                                >
                                                    {item.views === null
                                                        ? '--'
                                                        : formatNumber(item.views)}
                                                </td>
                                                <td
                                                    className='px-3 py-2 text-right text-terminal-dim'
                                                >
                                                    {item.favorerCount === null
                                                        ? '--'
                                                        : formatNumber(item.favorerCount)}
                                                </td>
                                                <td
                                                    className='px-3 py-2 text-right text-terminal-dim'
                                                >
                                                    {item.quantity ?? '--'}
                                                </td>
                                                <td
                                                    className='px-3 py-2 text-right text-terminal-green'
                                                >
                                                    {formatPrice(item.price)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            ) : null}
        </DetailPanel>
    );
}
