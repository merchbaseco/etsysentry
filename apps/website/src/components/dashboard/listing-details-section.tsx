import type { TrackedListingItem } from '@/lib/listings-api';
import { DetailRow, formatNumber, timeAgo } from '@/components/ui/dashboard';
import { formatListingPrice } from './listings-tab-utils';

const sectionTitleClassName =
    'mb-2 text-[10px] uppercase tracking-wider text-muted-foreground';
const panelClassName = 'rounded border border-border bg-secondary/50 p-3';
const rawPayloadClassName = 'max-h-72 overflow-auto rounded border border-border bg-secondary p-3';

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

const formatNativePrice = (item: TrackedListingItem): string => {
    if (!item.price) {
        return '--';
    }

    if (item.price.currencyCode === 'USD') {
        return `$${item.price.value.toFixed(2)} USD`;
    }

    return `${item.price.currencyCode} ${item.price.value.toFixed(2)}`;
};

const formatUsdPrice = (item: TrackedListingItem): string => {
    return item.priceUsdValue === null ? '--' : `$${item.priceUsdValue.toFixed(2)}`;
};

const formatUpdatedTimestamp = (value: number | null): string => {
    if (value === null) {
        return '--';
    }

    const milliseconds = value > 1_000_000_000_000 ? value : value * 1_000;
    const parsed = new Date(milliseconds);

    if (Number.isNaN(parsed.getTime())) {
        return String(value);
    }

    return `${value} (${parsed.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    })})`;
};

const getListingTypeLabel = (item: TrackedListingItem): string => {
    return item.isDigital ? 'digital' : 'physical';
};

export function ListingDetailsSection({ item }: { item: TrackedListingItem }) {
    const rawPayload = JSON.stringify(item, null, 2);

    return (
        <>
            <div>
                <h4 className={sectionTitleClassName}>Current Snapshot</h4>
                <div className="space-y-0">
                    <DetailRow label='Price (display)' value={formatListingPrice(item)} />
                    <DetailRow label='Price (native)' value={formatNativePrice(item)} />
                    <DetailRow label='Price (USD)' value={formatUsdPrice(item)} />
                    <DetailRow label='Views' value={formatMetricValue(item.views)} />
                    <DetailRow label='Favorites' value={formatMetricValue(item.numFavorers)} />
                    <DetailRow label='Quantity' value={item.quantity ?? '--'} />
                    <DetailRow label='Type' value={getListingTypeLabel(item)} />
                </div>
            </div>

            <div>
                <h4 className={sectionTitleClassName}>State</h4>
                <div className="space-y-0">
                    <DetailRow label='Etsy State' value={item.etsyState} />
                    <DetailRow label='Tracking State' value={item.trackingState} />
                    <DetailRow label='Sync State' value={item.syncState} />
                    <DetailRow label='Refreshed' value={timeAgo(item.lastRefreshedAt)} />
                    <DetailRow
                        label='Refreshed At'
                        value={formatIsoDateTime(item.lastRefreshedAt)}
                    />
                    <DetailRow label='Updated At' value={formatIsoDateTime(item.updatedAt)} />
                    <DetailRow
                        label='Updated Timestamp'
                        value={formatUpdatedTimestamp(item.updatedTimestamp)}
                    />
                </div>
            </div>

            <div>
                <h4 className={sectionTitleClassName}>Identifiers</h4>
                <div className="space-y-0">
                    <DetailRow label='Title' value={item.title} />
                    <DetailRow label='Tracked Listing ID' value={item.id} />
                    <DetailRow label='Etsy Listing ID' value={item.etsyListingId} />
                    <DetailRow label='Shop Name' value={item.shopName ?? '--'} />
                    <DetailRow label='Shop ID' value={item.shopId ?? '--'} />
                    <DetailRow label='Account ID' value={item.accountId} />
                    <DetailRow label='Tracker User ID' value={item.trackerClerkUserId} />
                </div>
            </div>

            <div>
                <h4 className={sectionTitleClassName}>Links & Media</h4>
                <div className={panelClassName}>
                    <div className="space-y-2 text-xs">
                        <div className="min-w-0">
                            <p
                                className='text-[10px] uppercase tracking-wider text-muted-foreground'
                            >
                                Listing URL
                            </p>
                            {item.url ? (
                                <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className='block truncate font-mono text-[11px] text-primary hover:underline'
                                    title={item.url}
                                >
                                    {item.url}
                                </a>
                            ) : (
                                <p className='font-mono text-[11px] text-muted-foreground'>--</p>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p
                                className='text-[10px] uppercase tracking-wider text-muted-foreground'
                            >
                                Thumbnail URL
                            </p>
                            {item.thumbnailUrl ? (
                                <a
                                    href={item.thumbnailUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className='block truncate font-mono text-[11px] text-primary hover:underline'
                                    title={item.thumbnailUrl}
                                >
                                    {item.thumbnailUrl}
                                </a>
                            ) : (
                                <p className='font-mono text-[11px] text-muted-foreground'>--</p>
                            )}
                        </div>
                        {item.thumbnailUrl ? (
                            <img
                                src={item.thumbnailUrl}
                                alt=""
                                className="h-40 w-full rounded border border-border object-cover"
                            />
                        ) : null}
                    </div>
                </div>
            </div>

            {item.lastRefreshError ? (
                <div>
                    <h4 className={sectionTitleClassName}>Last Refresh Error</h4>
                    <div
                        className='rounded border border-terminal-red/20 bg-terminal-red/10 p-3 text-xs text-terminal-red'
                    >
                        {item.lastRefreshError}
                    </div>
                </div>
            ) : null}

            <div>
                <h4 className={sectionTitleClassName}>Raw Listing Payload</h4>
                <pre className={rawPayloadClassName}>
                    <code
                        className='whitespace-pre-wrap break-all font-mono text-[10px] text-foreground'
                    >
                        {rawPayload}
                    </code>
                </pre>
            </div>
        </>
    );
}
