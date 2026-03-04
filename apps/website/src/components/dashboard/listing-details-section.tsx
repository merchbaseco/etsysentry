import { ExternalLink, Store } from 'lucide-react';
import { formatNumber, timeAgo, timeUntil } from '@/components/ui/dashboard';
import type { GetTrackedListingMetricHistoryOutput, TrackedListingItem } from '@/lib/listings-api';
import { type ListingNextRefresh, resolveListingNextRefresh } from './listing-refresh-schedule';
import { formatListingPrice } from './listings-tab-utils';

const sectionBarClassName =
    'flex items-center justify-between -mt-px border-y border-border bg-secondary px-4 py-1.5';
const sectionBarLabelClassName =
    'text-[11px] font-medium uppercase tracking-widest text-muted-foreground';
const rowClassName = 'flex items-center justify-between gap-4 border-b border-border/50 px-4 py-2';
const compactRowClassName =
    'flex items-center justify-between gap-4 border-b border-border/50 px-4 py-1.5';
const rowLabelClassName = 'shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground';
const rowValueClassName = 'truncate text-right font-mono text-xs text-foreground';

const formatMetricValue = (value: number | null): string => {
    return value === null ? '--' : formatNumber(value);
};

const formatIsoDateTime = (value: string): string => {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
};

export function ListingDetailsSection({
    item,
    historyItems,
}: {
    item: TrackedListingItem;
    historyItems: GetTrackedListingMetricHistoryOutput['items'];
}) {
    const nextRefresh = resolveListingNextRefresh({
        item: {
            isDigital: item.isDigital,
            lastRefreshedAt: item.lastRefreshedAt,
            syncState: item.syncState,
            trackingState: item.trackingState,
        },
        historyItems,
    });
    const formatNextRefreshValue = (value: ListingNextRefresh): string => {
        if (value.kind === 'in_progress') {
            return 'Running now';
        }

        if (value.kind === 'paused') {
            return 'Paused';
        }

        if (value.kind === 'disabled') {
            return 'Disabled';
        }

        if (value.kind === 'unknown') {
            return '--';
        }

        const nextRefreshAtMs = new Date(value.at).getTime();

        if (Number.isNaN(nextRefreshAtMs)) {
            return '--';
        }

        if (nextRefreshAtMs <= Date.now()) {
            return `Due now \u00b7 ${formatIsoDateTime(value.at)}`;
        }

        return `${timeUntil(value.at)} \u00b7 ${formatIsoDateTime(value.at)}`;
    };

    return (
        <>
            {item.thumbnailUrl ? (
                <a
                    className="block border-border border-b bg-secondary/30"
                    href={item.url ?? item.thumbnailUrl}
                    rel="noreferrer"
                    target="_blank"
                >
                    <img
                        alt={item.title}
                        className="mx-auto max-h-64 object-contain"
                        height={512}
                        src={item.thumbnailUrl}
                        width={512}
                    />
                </a>
            ) : null}

            <div className={rowClassName}>
                <div className="flex min-w-0 items-center gap-2">
                    <Store className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-mono text-foreground text-xs">
                        {item.shopName ?? '--'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        {item.isDigital ? 'Digital' : 'Physical'}
                    </span>
                </div>
                {item.url ? (
                    <a
                        className="inline-flex shrink-0 items-center gap-1.5 text-primary text-xs hover:underline"
                        href={item.url}
                        rel="noreferrer"
                        target="_blank"
                    >
                        <ExternalLink className="size-3" />
                        Etsy
                    </a>
                ) : null}
            </div>

            <div className={sectionBarClassName}>
                <span className={sectionBarLabelClassName}>Snapshot</span>
            </div>
            <div className={rowClassName}>
                <span className={rowLabelClassName}>Price</span>
                <span className="truncate text-right font-mono text-terminal-green text-xs">
                    {formatListingPrice(item)}
                </span>
            </div>
            <div className={rowClassName}>
                <span className={rowLabelClassName}>Views</span>
                <span className={rowValueClassName}>{formatMetricValue(item.views)}</span>
            </div>
            <div className={rowClassName}>
                <span className={rowLabelClassName}>Favorites</span>
                <span className={rowValueClassName}>{formatMetricValue(item.numFavorers)}</span>
            </div>
            <div className={rowClassName}>
                <span className={rowLabelClassName}>Quantity</span>
                <span className={rowValueClassName}>{item.quantity?.toString() ?? '--'}</span>
            </div>
            <div className={sectionBarClassName}>
                <span className={sectionBarLabelClassName}>Tags</span>
            </div>
            <div className="border-border/50 border-b px-4 py-2">
                {item.tags.length === 0 ? (
                    <span className={rowValueClassName}>--</span>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {item.tags.map((tag) => (
                            <span
                                className="rounded-full border border-border/70 bg-secondary px-2 py-0.5 font-mono text-[11px] text-foreground"
                                key={`${item.id}:${tag}`}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className={sectionBarClassName}>
                <span className={sectionBarLabelClassName}>Refresh</span>
            </div>
            <div className={compactRowClassName}>
                <span className={rowLabelClassName}>Last</span>
                <span className={rowValueClassName}>
                    {timeAgo(item.lastRefreshedAt)}
                    {' \u00b7 '}
                    {formatIsoDateTime(item.lastRefreshedAt)}
                </span>
            </div>
            <div className={compactRowClassName}>
                <span className={rowLabelClassName}>Next</span>
                <span className={rowValueClassName}>{formatNextRefreshValue(nextRefresh)}</span>
            </div>

            {item.lastRefreshError ? (
                <>
                    <div className={sectionBarClassName}>
                        <span className={sectionBarLabelClassName}>Last Refresh Error</span>
                    </div>
                    <div className="px-4 py-3 text-terminal-red text-xs">
                        {item.lastRefreshError}
                    </div>
                </>
            ) : null}
        </>
    );
}
