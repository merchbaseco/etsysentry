import type { GetTrackedListingMetricHistoryOutput, TrackedListingItem } from '@/lib/listings-api';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const FIVE_DAYS_IN_MS = 5 * DAY_IN_MS;
const FOURTEEN_DAYS_IN_MS = 14 * DAY_IN_MS;

const REFRESH_INTERVAL_MS_BY_TIER = {
    '1d': DAY_IN_MS,
    '3d': 3 * DAY_IN_MS,
    '7d': 7 * DAY_IN_MS,
} as const;

type ListingRefreshCadenceTier = keyof typeof REFRESH_INTERVAL_MS_BY_TIER;
type ListingHistoryItem = GetTrackedListingMetricHistoryOutput['items'][number];

interface ListingMomentumSnapshot {
    favorerCount: number | null;
    observedAt: Date;
    quantity: number | null;
}

export interface ListingRefreshScheduleInput {
    isDigital: TrackedListingItem['isDigital'];
    lastRefreshedAt: TrackedListingItem['lastRefreshedAt'];
    syncState: TrackedListingItem['syncState'];
    trackingState: TrackedListingItem['trackingState'];
}

export type ListingNextRefresh =
    | {
          at: string;
          cadenceTier: ListingRefreshCadenceTier;
          kind: 'scheduled';
      }
    | { kind: 'in_progress' }
    | { kind: 'paused' }
    | { kind: 'disabled' }
    | { kind: 'unknown' };

const toObservedAt = (observedDate: string): Date | null => {
    const observedAt = new Date(`${observedDate}T00:00:00.000Z`);

    if (Number.isNaN(observedAt.getTime())) {
        return null;
    }

    return observedAt;
};

const toSnapshots = (historyItems: ListingHistoryItem[]): ListingMomentumSnapshot[] => {
    const snapshots: ListingMomentumSnapshot[] = [];

    for (const historyItem of historyItems) {
        const observedAt = toObservedAt(historyItem.observedDate);

        if (!observedAt) {
            continue;
        }

        snapshots.push({
            observedAt,
            favorerCount: historyItem.favorerCount,
            quantity: historyItem.quantity,
        });
    }

    return snapshots;
};

const hasRecentMomentumSignal = (params: {
    latest: ListingMomentumSnapshot;
    previous: ListingMomentumSnapshot;
}): boolean => {
    const latestFavorers = params.latest.favorerCount;
    const previousFavorers = params.previous.favorerCount;
    const latestQuantity = params.latest.quantity;
    const previousQuantity = params.previous.quantity;
    const favorersDelta =
        latestFavorers !== null && previousFavorers !== null
            ? Math.max(0, latestFavorers - previousFavorers)
            : 0;
    const quantityDrop =
        latestQuantity !== null && previousQuantity !== null
            ? Math.max(0, previousQuantity - latestQuantity)
            : 0;

    return favorersDelta >= 1 || quantityDrop >= 1;
};

const resolveCadenceTierFromSnapshots = (params: {
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

        if (!(latest && previous)) {
            continue;
        }

        if (hasRecentMomentumSignal({ latest, previous })) {
            latestSignalObservedAt = latest.observedAt;
            break;
        }
    }

    if (!latestSignalObservedAt) {
        const newestObservedAt = params.snapshots[0]?.observedAt;
        const oldestObservedAt = params.snapshots.at(-1)?.observedAt;

        if (!(newestObservedAt && oldestObservedAt)) {
            return '1d';
        }

        const coverageMs = Math.max(0, newestObservedAt.getTime() - oldestObservedAt.getTime());

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

export const resolveListingNextRefresh = (params: {
    historyItems: ListingHistoryItem[];
    item: ListingRefreshScheduleInput;
    now?: Date;
}): ListingNextRefresh => {
    const { item } = params;

    if (item.syncState === 'queued' || item.syncState === 'syncing') {
        return {
            kind: 'in_progress',
        };
    }

    if (item.trackingState === 'fatal') {
        return {
            kind: 'disabled',
        };
    }

    if (!item.isDigital && item.trackingState === 'paused') {
        return {
            kind: 'paused',
        };
    }

    const lastRefreshedAtMs = new Date(item.lastRefreshedAt).getTime();

    if (Number.isNaN(lastRefreshedAtMs)) {
        return {
            kind: 'unknown',
        };
    }

    const now = params.now ?? new Date();
    const cadenceTier = resolveCadenceTierFromSnapshots({
        now,
        snapshots: toSnapshots(params.historyItems),
    });

    return {
        kind: 'scheduled',
        cadenceTier,
        at: new Date(lastRefreshedAtMs + REFRESH_INTERVAL_MS_BY_TIER[cadenceTier]).toISOString(),
    };
};
