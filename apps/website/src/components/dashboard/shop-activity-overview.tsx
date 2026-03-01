import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatNumber, StatusBadge, timeAgo, timeUntil } from '@/components/ui/dashboard';
import type { ShopActivityOverview } from '@/lib/shops-api';

const WHITESPACE_SPLIT_REGEX = /\s+/;

const toInitials = (value: string): string => {
    const letters = value
        .trim()
        .split(WHITESPACE_SPLIT_REGEX)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .filter((part) => part.length > 0)
        .slice(0, 2)
        .join('');

    if (letters.length > 0) {
        return letters;
    }

    return 'SH';
};

const toCompactNumberLabel = (value: number): string => {
    return formatNumber(value);
};

const toReviewLabel = (overview: ShopActivityOverview | null): string | null => {
    const reviewCount = overview?.reviewCount ?? overview?.latestSnapshot?.reviewTotal ?? null;
    const reviewAverage = overview?.reviewAverage ?? null;

    if (reviewCount === null) {
        return null;
    }

    if (reviewAverage === null) {
        return toCompactNumberLabel(reviewCount);
    }

    return `${reviewAverage.toFixed(1)} (${toCompactNumberLabel(reviewCount)})`;
};

const toSalesLabel = (overview: ShopActivityOverview | null): string => {
    const soldCount = overview?.soldCount ?? overview?.latestSnapshot?.soldTotal ?? null;
    return soldCount === null ? '--' : toCompactNumberLabel(soldCount);
};

const toMetricLabel = (value: number | null): string => {
    return value === null ? '--' : toCompactNumberLabel(value);
};

const toStatusLabel = (isTrackedShop: boolean | null, isOverviewLoading: boolean): ReactNode => {
    if (isOverviewLoading || isTrackedShop === null) {
        return (
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                Checking...
            </span>
        );
    }

    if (isTrackedShop) {
        return null;
    }

    return (
        <span className="rounded bg-terminal-yellow/15 px-1.5 py-0.5 text-[10px] text-terminal-yellow uppercase tracking-wider">
            Untracked
        </span>
    );
};

interface OverviewMetricCardProps {
    label: string;
    value: string;
}

function OverviewMetricCard({ label, value }: OverviewMetricCardProps) {
    return (
        <div className="rounded border border-border/70 bg-background/70 px-2 py-1.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-[0.18em]">{label}</p>
            <p className="mt-0.5 truncate font-medium text-[12px] text-foreground">{value}</p>
        </div>
    );
}

export function ShopActivityOverviewHeader(props: {
    etsyShopId: string | undefined;
    isOverviewLoading: boolean;
    isTrackedShop: boolean | null;
    overview: ShopActivityOverview | null;
    shopTitle: string;
}) {
    const avatarFallback = toInitials(props.shopTitle);
    const reviewLabel = toReviewLabel(props.overview);
    const trackingStatus = toStatusLabel(props.isTrackedShop, props.isOverviewLoading);
    const snapshot = props.overview?.latestSnapshot ?? null;

    return (
        <div className="border-border border-b bg-secondary/20 px-3 py-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <Avatar className="size-12 border border-border bg-secondary">
                        <AvatarImage
                            alt={props.shopTitle}
                            src={props.overview?.avatarUrl ?? undefined}
                        />
                        <AvatarFallback className="font-semibold text-[11px] text-muted-foreground">
                            {avatarFallback}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <h2 className="truncate font-semibold text-sm tracking-wide">
                                {props.shopTitle}
                            </h2>
                            {props.isTrackedShop === true ? (
                                <StatusBadge status={props.overview?.trackingState ?? 'active'} />
                            ) : null}
                            {trackingStatus}
                            {props.overview?.syncState ? (
                                <StatusBadge status={props.overview.syncState} />
                            ) : null}
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground">
                            {props.etsyShopId ?? '--'}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                            {props.overview?.locationLabel ? (
                                <span className="truncate">{props.overview.locationLabel}</span>
                            ) : null}
                            {props.overview?.shopUrl ? (
                                <a
                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                    href={props.overview.shopUrl}
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    <ExternalLink className="size-3" />
                                    Etsy
                                </a>
                            ) : null}
                        </div>
                        {props.overview?.metadataError ? (
                            <p className="mt-1 text-[11px] text-terminal-yellow">
                                Live shop metadata is currently unavailable.
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1.5 md:grid-cols-4 xl:grid-cols-8">
                <OverviewMetricCard
                    label="Active Listings"
                    value={toMetricLabel(snapshot?.activeListingCount ?? null)}
                />
                <OverviewMetricCard
                    label="New Listings"
                    value={toMetricLabel(snapshot?.newListingCount ?? null)}
                />
                <OverviewMetricCard
                    label="Favorites Total"
                    value={toMetricLabel(snapshot?.favoritesTotal ?? null)}
                />
                <OverviewMetricCard label="Sold Total" value={toSalesLabel(props.overview)} />
                <OverviewMetricCard label="Reviews" value={reviewLabel ?? '--'} />
                <OverviewMetricCard
                    label="Next Sync"
                    value={props.overview?.nextSyncAt ? timeUntil(props.overview.nextSyncAt) : '--'}
                />
                <OverviewMetricCard
                    label="Last Refresh"
                    value={
                        props.overview?.lastRefreshedAt
                            ? timeAgo(props.overview.lastRefreshedAt)
                            : '--'
                    }
                />
                <OverviewMetricCard
                    label="Shop State"
                    value={props.overview?.trackingState ?? '--'}
                />
            </div>

            {props.overview?.lastRefreshedAt ? (
                <p className="mt-2 text-[10px] text-muted-foreground">
                    Last refreshed {timeAgo(props.overview.lastRefreshedAt)}
                </p>
            ) : null}
        </div>
    );
}
