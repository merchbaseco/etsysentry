import { trackedListings } from '../../db/schema';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const THREE_DAYS_IN_MS = 3 * DAY_IN_MS;
const SEVEN_DAYS_IN_MS = 7 * DAY_IN_MS;
const FIVE_DAYS_IN_MS = 5 * DAY_IN_MS;
const FOURTEEN_DAYS_IN_MS = 14 * DAY_IN_MS;

export const listingRefreshCadenceTiers = ['1d', '3d', '7d'] as const;

export type ListingRefreshCadenceTier = (typeof listingRefreshCadenceTiers)[number];

export const LISTING_REFRESH_INTERVAL_MS_BY_TIER = {
    '1d': DAY_IN_MS,
    '3d': THREE_DAYS_IN_MS,
    '7d': SEVEN_DAYS_IN_MS
} as const satisfies Record<ListingRefreshCadenceTier, number>;

export const LISTING_REFRESH_POLICY_LABEL_BY_TIER = {
    '1d': 'Auto enqueue every 24h (recent favorites or sales)',
    '3d': 'Auto enqueue every 72h (quiet for 5+ days)',
    '7d': 'Auto enqueue every 168h (quiet for 14+ days)'
} as const satisfies Record<ListingRefreshCadenceTier, string>;

export const listingMomentumThresholds = {
    dailyFavorersDelta: 1,
    dailyQuantityDrop: 1
} as const;

export type ListingMomentumSignals = {
    favorersDelta: number;
    quantityDrop: number;
    viewsDelta: number;
};

export type ListingMomentumSnapshot = {
    observedAt: Date;
    favorerCount: number | null;
    quantity: number | null;
    views: number | null;
};

export const getListingRefreshCadenceTier = (
    signals: ListingMomentumSignals
): ListingRefreshCadenceTier => {
    if (
        signals.quantityDrop >= listingMomentumThresholds.dailyQuantityDrop ||
        signals.favorersDelta >= listingMomentumThresholds.dailyFavorersDelta
    ) {
        return '1d';
    }

    return '3d';
};

export const computeListingRefreshStaleBefore = (params: {
    now: Date;
    cadenceTier: ListingRefreshCadenceTier;
}): Date => {
    return new Date(params.now.getTime() - LISTING_REFRESH_INTERVAL_MS_BY_TIER[params.cadenceTier]);
};

export const isListingAutoRefreshEligible = (params: {
    isDigital: boolean;
    trackingState: (typeof trackedListings.$inferSelect)['trackingState'];
}): boolean => {
    if (params.trackingState === 'fatal') {
        return false;
    }

    if (params.isDigital) {
        return true;
    }

    return params.trackingState !== 'paused';
};

export const toListingMomentumSignals = (params: {
    latest: ListingMomentumSnapshot | null;
    previous: ListingMomentumSnapshot | null;
}): ListingMomentumSignals => {
    const latestViews = params.latest?.views;
    const previousViews = params.previous?.views;
    const latestFavorers = params.latest?.favorerCount;
    const previousFavorers = params.previous?.favorerCount;
    const latestQuantity = params.latest?.quantity;
    const previousQuantity = params.previous?.quantity;

    const viewsDelta =
        latestViews !== null && latestViews !== undefined &&
        previousViews !== null && previousViews !== undefined
            ? Math.max(0, latestViews - previousViews)
            : 0;
    const favorersDelta =
        latestFavorers !== null && latestFavorers !== undefined &&
        previousFavorers !== null && previousFavorers !== undefined
            ? Math.max(0, latestFavorers - previousFavorers)
            : 0;
    const quantityDrop =
        latestQuantity !== null && latestQuantity !== undefined &&
        previousQuantity !== null && previousQuantity !== undefined
            ? Math.max(0, previousQuantity - latestQuantity)
            : 0;

    return {
        favorersDelta,
        quantityDrop,
        viewsDelta
    };
};

export const resolveListingRefreshCadenceTierFromSnapshots = (params: {
    now: Date;
    snapshots: ListingMomentumSnapshot[];
}): ListingRefreshCadenceTier => {
    if (params.snapshots.length < 2) {
        return '1d';
    }

    let latestSignalObservedAt: Date | null = null;

    for (let index = 0; index < params.snapshots.length - 1; index += 1) {
        const latest = params.snapshots[index];
        const previous = params.snapshots[index + 1];

        if (!latest || !previous) {
            continue;
        }

        const tierForPair = getListingRefreshCadenceTier(
            toListingMomentumSignals({
                latest,
                previous
            })
        );

        if (tierForPair === '1d') {
            latestSignalObservedAt = latest.observedAt;
            break;
        }
    }

    if (!latestSignalObservedAt) {
        const newest = params.snapshots[0]?.observedAt;
        const oldest = params.snapshots[params.snapshots.length - 1]?.observedAt;

        if (!newest || !oldest) {
            return '1d';
        }

        const coverageMs = Math.max(0, newest.getTime() - oldest.getTime());

        if (coverageMs >= FOURTEEN_DAYS_IN_MS) {
            return '7d';
        }

        if (coverageMs >= FIVE_DAYS_IN_MS) {
            return '3d';
        }

        return '1d';
    }

    const sinceSignalMs = Math.max(0, params.now.getTime() - latestSignalObservedAt.getTime());

    if (sinceSignalMs < FIVE_DAYS_IN_MS) {
        return '1d';
    }

    if (sinceSignalMs < FOURTEEN_DAYS_IN_MS) {
        return '3d';
    }

    return '7d';
};
