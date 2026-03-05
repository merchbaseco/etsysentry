import type {
    KeywordActivityRankChanges,
    KeywordActivityRankPoint,
} from './keyword-activity-types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toObservedAtMs = (observedAt: string): number | null => {
    const value = new Date(observedAt).getTime();
    return Number.isFinite(value) ? value : null;
};

const toRankAtOrBefore = (points: KeywordActivityRankPoint[], targetMs: number): number | null => {
    let baselineRank: number | null = null;
    let baselineMs = Number.NEGATIVE_INFINITY;

    for (const point of points) {
        const observedAtMs = toObservedAtMs(point.observedAt);

        if (observedAtMs === null || observedAtMs > targetMs || observedAtMs < baselineMs) {
            continue;
        }

        baselineMs = observedAtMs;
        baselineRank = point.rank;
    }

    return baselineRank;
};

const toRankChange = (currentRank: number, baselineRank: number | null): number => {
    if (baselineRank === null) {
        return 0;
    }

    return baselineRank - currentRank;
};

export const toKeywordRankChanges = (params: {
    bestRank: number | null;
    currentRank: number;
    latestObservedAt: string;
    trendHistory: KeywordActivityRankPoint[];
}): KeywordActivityRankChanges => {
    const latestObservedAtMs = toObservedAtMs(params.latestObservedAt);

    if (latestObservedAtMs === null) {
        return {
            bestRank: params.bestRank ?? params.currentRank,
            change1d: 0,
            change7d: 0,
            change30d: 0,
        };
    }

    const baseline1d = toRankAtOrBefore(params.trendHistory, latestObservedAtMs - MS_PER_DAY);
    const baseline7d = toRankAtOrBefore(params.trendHistory, latestObservedAtMs - 7 * MS_PER_DAY);
    const baseline30d = toRankAtOrBefore(params.trendHistory, latestObservedAtMs - 30 * MS_PER_DAY);

    return {
        bestRank: params.bestRank ?? params.currentRank,
        change1d: toRankChange(params.currentRank, baseline1d),
        change7d: toRankChange(params.currentRank, baseline7d),
        change30d: toRankChange(params.currentRank, baseline30d),
    };
};
