import { ExternalLink, Store } from 'lucide-react';
import type { TrackedListingItem } from '@/lib/listings-api';
import { formatNumber, StatusBadge, timeAgo } from '@/components/ui/dashboard';
import { formatListingPrice } from './listings-tab-utils';

const sectionBarClassName =
    'flex items-center justify-between -mt-px border-y border-border bg-secondary px-4 py-1.5';
const sectionBarLabelClassName =
    'text-[11px] font-medium uppercase tracking-widest text-muted-foreground';
const rowClassName =
    'flex items-center justify-between gap-4 border-b border-border/50 px-4 py-2';
const rowLabelClassName =
    'shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground';
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
        timeStyle: 'short'
    });
};

export function ListingDetailsSection({ item }: { item: TrackedListingItem }) {
    return (
        <>
            {item.thumbnailUrl ? (
                <a
                    href={item.url ?? item.thumbnailUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block border-b border-border bg-secondary/30"
                >
                    <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="mx-auto max-h-64 object-contain"
                    />
                </a>
            ) : null}

            <div className={rowClassName}>
                <div className="flex items-center gap-2 min-w-0">
                    <Store className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-mono text-xs text-foreground">
                        {item.shopName ?? '--'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        {item.isDigital ? 'Digital' : 'Physical'}
                    </span>
                </div>
                {item.url ? (
                    <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
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
                <span className="truncate text-right font-mono text-xs text-terminal-green">
                    {formatListingPrice(item)}
                </span>
            </div>
            <div className={rowClassName}>
                <span className={rowLabelClassName}>Views</span>
                <span className={rowValueClassName}>{formatMetricValue(item.views)}</span>
            </div>
            <div className={rowClassName}>
                <span className={rowLabelClassName}>Favorites</span>
                <span className={rowValueClassName}>
                    {formatMetricValue(item.numFavorers)}
                </span>
            </div>
            <div className={rowClassName}>
                <span className={rowLabelClassName}>Quantity</span>
                <span className={rowValueClassName}>
                    {item.quantity?.toString() ?? '--'}
                </span>
            </div>

            <div className={sectionBarClassName}>
                <span className={sectionBarLabelClassName}>Status</span>
                <span className="text-[10px] text-muted-foreground">
                    {timeAgo(item.lastRefreshedAt)}
                    {' \u00b7 '}
                    {formatIsoDateTime(item.lastRefreshedAt)}
                </span>
            </div>
            <div className={rowClassName}>
                <span className={rowLabelClassName}>Etsy</span>
                <StatusBadge status={item.etsyState} />
            </div>
            <div className={rowClassName}>
                <span className={rowLabelClassName}>Tracking</span>
                <StatusBadge status={item.trackingState} />
            </div>
            <div className={rowClassName}>
                <span className={rowLabelClassName}>Sync</span>
                <StatusBadge status={item.syncState} />
            </div>

            {item.lastRefreshError ? (
                <>
                    <div className={sectionBarClassName}>
                        <span className={sectionBarLabelClassName}>Last Refresh Error</span>
                    </div>
                    <div className="px-4 py-3 text-xs text-terminal-red">
                        {item.lastRefreshError}
                    </div>
                </>
            ) : null}
        </>
    );
}
