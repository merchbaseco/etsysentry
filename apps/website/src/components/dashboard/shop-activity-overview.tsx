import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatNumber, timeAgo, timeUntil } from '@/components/ui/dashboard';
import type { ShopActivityOverview } from '@/lib/shops-api';
import { cn } from '@/lib/utils';
import { type MetricTrendData, toMetricTrendData } from './shop-activity-trend-data';
import { ShopMetricSparkline, type ShopMetricSparklineTone } from './shop-metric-sparkline';

const WHITESPACE_SPLIT_REGEX = /\s+/;

const toneTextClassByTone: Record<ShopMetricSparklineTone, string> = {
    down: 'text-terminal-red',
    neutral: 'text-muted-foreground',
    up: 'text-terminal-green',
};

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

const toMetricLabel = (value: number | null): string => {
    return value === null ? '--' : toCompactNumberLabel(value);
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

const toSalesPerDayValueLabel = (overview: ShopActivityOverview | null): string => {
    const derivedSalesPerDay = overview?.derivedSalesPerDay;

    if (!derivedSalesPerDay || derivedSalesPerDay.value === null) {
        return '--';
    }

    return `${derivedSalesPerDay.value.toFixed(2)}/d`;
};

const toFavoritesPerDayValueLabel = (overview: ShopActivityOverview | null): string => {
    const derivedFavoritesPerDay = overview?.derivedFavoritesPerDay;

    if (!derivedFavoritesPerDay || derivedFavoritesPerDay.value === null) {
        return '--';
    }

    return `${derivedFavoritesPerDay.value.toFixed(2)}/d`;
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

function OverviewMetaBadge(props: { label: string; meta?: string | null; value: string }) {
    return (
        <div className="rounded border border-border/70 bg-background/60 px-2 py-1">
            <p className="text-[9px] text-muted-foreground uppercase tracking-[0.16em]">
                {props.label}
            </p>
            <p className="mt-0.5 font-medium text-[11px] text-foreground">{props.value}</p>
            {props.meta ? (
                <p className="mt-0.5 text-[9px] text-muted-foreground uppercase tracking-[0.08em]">
                    {props.meta}
                </p>
            ) : null}
        </div>
    );
}

function PrimaryMetricCard(props: { currentValue: string; label: string; trend: MetricTrendData }) {
    return (
        <div className="rounded border border-border/80 bg-background/70 px-2.5 py-2">
            <div className="flex items-start justify-between gap-2">
                <p className="text-[9px] text-muted-foreground uppercase tracking-[0.18em]">
                    {props.label}
                </p>
                <p className={cn('font-medium text-[10px]', toneTextClassByTone[props.trend.tone])}>
                    {props.trend.deltaLabel}
                </p>
            </div>
            <p className="mt-0.5 truncate font-semibold text-[16px] text-foreground">
                {props.currentValue}
            </p>
            <ShopMetricSparkline
                ariaLabel={`${props.label} trend sparkline`}
                points={props.trend.points}
                summaryLabel={props.trend.summaryLabel}
                tone={props.trend.tone}
            />
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
    const metricHistory = props.overview?.metricHistory ?? [];
    const activeListingsTrend = toMetricTrendData({
        metricHistory,
        metricLabel: 'Active Listings',
        metricSelector: (point) => point.activeListingCount,
    });
    const salesPerDayTrend = toMetricTrendData({
        metricHistory,
        metricLabel: 'Sales / Day',
        metricSelector: (point) => point.soldDelta,
    });
    const favoritesPerDayTrend = toMetricTrendData({
        metricHistory,
        metricLabel: 'Favorites / Day',
        metricSelector: (point) => point.favoritesDelta,
    });

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
                            {trackingStatus}
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

                <div className="flex max-w-full flex-wrap content-start items-start justify-end gap-1.5 self-start">
                    <OverviewMetaBadge
                        label="Next Sync"
                        value={
                            props.overview?.nextSyncAt ? timeUntil(props.overview.nextSyncAt) : '--'
                        }
                    />
                    <OverviewMetaBadge
                        label="Last Refresh"
                        value={
                            props.overview?.lastRefreshedAt
                                ? timeAgo(props.overview.lastRefreshedAt)
                                : '--'
                        }
                    />
                    <OverviewMetaBadge
                        label="Sold Total"
                        value={toMetricLabel(props.overview?.soldCount ?? null)}
                    />
                    <OverviewMetaBadge
                        label="Favorites Total"
                        value={toMetricLabel(snapshot?.favoritesTotal ?? null)}
                    />
                    <OverviewMetaBadge label="Reviews" value={reviewLabel ?? '--'} />
                </div>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-3">
                <PrimaryMetricCard
                    currentValue={toMetricLabel(snapshot?.activeListingCount ?? null)}
                    label="Active Listings"
                    trend={activeListingsTrend}
                />
                <PrimaryMetricCard
                    currentValue={toSalesPerDayValueLabel(props.overview)}
                    label="Sales / Day"
                    trend={salesPerDayTrend}
                />
                <PrimaryMetricCard
                    currentValue={toFavoritesPerDayValueLabel(props.overview)}
                    label="Favorites / Day"
                    trend={favoritesPerDayTrend}
                />
            </div>
        </div>
    );
}
