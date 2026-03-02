import { type ReactNode, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { DetailPanel, formatNumber } from '@/components/ui/dashboard';
import { useTrackedListingMetricHistory } from '@/hooks/use-tracked-listing-metric-history';
import type { GetTrackedListingMetricHistoryOutput, TrackedListingItem } from '@/lib/listings-api';
import { TrpcRequestError } from '@/lib/trpc-http';
import { ListingDetailsSection } from './listing-details-section';

const HISTORY_WINDOW_DAYS = 90;
const sectionBarClassName =
    'flex items-center justify-between -mt-px border-y border-border bg-secondary px-4 py-1.5';
const sectionBarLabelClassName =
    'text-[11px] font-medium uppercase tracking-widest text-muted-foreground';
const tableHeaderCellClassName =
    'px-3 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground';
const tableHeaderLeftCellClassName =
    'px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground';
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
        timeZone: 'UTC',
    });
};

export function ListingHistoryDrawer({
    selectedListing,
    onClose,
}: {
    selectedListing: TrackedListingItem | null;
    onClose: () => void;
}) {
    const selectedListingId = selectedListing?.id ?? '';
    const trackedListingMetricHistoryQuery = useTrackedListingMetricHistory(
        {
            trackedListingId: selectedListingId,
            days: HISTORY_WINDOW_DAYS,
        },
        {
            enabled: Boolean(selectedListing),
        }
    );
    const history: GetTrackedListingMetricHistoryOutput | null =
        trackedListingMetricHistoryQuery.data ?? null;
    const isLoading = trackedListingMetricHistoryQuery.isFetching;
    const errorMessage = trackedListingMetricHistoryQuery.error
        ? toErrorMessage(trackedListingMetricHistoryQuery.error)
        : null;
    const refetchTrackedListingMetricHistory = trackedListingMetricHistoryQuery.refetch;
    const loadHistory = useCallback(async () => {
        await refetchTrackedListingMetricHistory();
    }, [refetchTrackedListingMetricHistory]);
    const historyItems = history?.items ?? [];
    let historySectionContent: ReactNode;

    if (isLoading) {
        historySectionContent = (
            <div className="px-4 py-4 text-muted-foreground text-xs">Loading daily history...</div>
        );
    } else if (errorMessage) {
        historySectionContent = (
            <div className="space-y-3 px-4 py-3">
                <p className="text-terminal-red text-xs">{errorMessage}</p>
                <Button
                    onClick={() => {
                        if (!selectedListing) {
                            return;
                        }

                        loadHistory();
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    Retry
                </Button>
            </div>
        );
    } else if (historyItems.length === 0) {
        historySectionContent = (
            <div className="px-4 py-4 text-muted-foreground text-xs">No history captured yet.</div>
        );
    } else {
        historySectionContent = (
            <>
                <div className={sectionBarClassName}>
                    <span className={sectionBarLabelClassName}>Daily History</span>
                </div>
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-border/70 border-b">
                            <th className={tableHeaderLeftCellClassName}>Day (UTC)</th>
                            <th className={tableHeaderCellClassName}>Views</th>
                            <th className={tableHeaderCellClassName}>Favs</th>
                            <th className={tableHeaderCellClassName}>Qty</th>
                            <th className={tableHeaderCellClassName}>Sold Est.</th>
                            <th className={tableHeaderCellClassName}>Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        {historyItems.map((item) => (
                            <tr
                                className="border-border/50 border-b last:border-b-0"
                                key={item.observedDate}
                            >
                                <td className="px-3 py-2 font-mono text-[11px]">
                                    {formatObservedDate(item.observedDate)}
                                </td>
                                <td className="px-3 py-2 text-right text-terminal-dim">
                                    {item.views === null ? '--' : formatNumber(item.views)}
                                </td>
                                <td className="px-3 py-2 text-right text-terminal-dim">
                                    {item.favorerCount === null
                                        ? '--'
                                        : formatNumber(item.favorerCount)}
                                </td>
                                <td className="px-3 py-2 text-right text-terminal-dim">
                                    {item.quantity ?? '--'}
                                </td>
                                <td className="px-3 py-2 text-right text-terminal-dim">
                                    {formatNumber(item.estimatedSoldCount)}
                                </td>
                                <td className="px-3 py-2 text-right text-terminal-green">
                                    {formatPrice(item.price)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </>
        );
    }

    return (
        <DetailPanel
            onClose={onClose}
            open={Boolean(selectedListing)}
            size="wide"
            title={selectedListing?.title ?? ''}
        >
            {selectedListing ? (
                <>
                    <ListingDetailsSection item={selectedListing} />

                    {historySectionContent}
                </>
            ) : null}
        </DetailPanel>
    );
}
