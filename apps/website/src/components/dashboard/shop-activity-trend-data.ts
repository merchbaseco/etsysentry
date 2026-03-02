import { formatNumber } from '@/components/ui/dashboard';
import type { ShopActivityOverview } from '@/lib/shops-api';
import type { ShopMetricSparklineTone } from './shop-metric-sparkline';

const msPerDay = 86_400_000;

type MetricHistoryPoint = ShopActivityOverview['metricHistory'][number];

export interface MetricTrendData {
    deltaLabel: string;
    points: Array<{
        observedAt: string;
        value: number | null;
    }>;
    summaryLabel: string;
    tone: ShopMetricSparklineTone;
}

const toCompactNumberLabel = (value: number): string => {
    return formatNumber(value);
};

export const toMetricTrendData = (params: {
    metricLabel: string;
    metricSelector: (point: MetricHistoryPoint) => number | null;
    metricHistory: MetricHistoryPoint[];
}): MetricTrendData => {
    const points = params.metricHistory.map((point) => ({
        observedAt: point.observedAt,
        value: params.metricSelector(point),
    }));
    const usablePoints = points.filter(
        (point): point is { observedAt: string; value: number } => point.value !== null
    );

    if (usablePoints.length < 2) {
        return {
            deltaLabel: 'Not enough history',
            points,
            summaryLabel: `${params.metricLabel}: trend unavailable`,
            tone: 'neutral',
        };
    }

    const firstPoint = usablePoints[0];
    const lastPoint = usablePoints.at(-1);

    if (!(firstPoint && lastPoint)) {
        return {
            deltaLabel: 'Not enough history',
            points,
            summaryLabel: `${params.metricLabel}: trend unavailable`,
            tone: 'neutral',
        };
    }

    const deltaValue = lastPoint.value - firstPoint.value;
    const rangeDays = Math.max(
        1,
        Math.round(
            (Date.parse(lastPoint.observedAt) - Date.parse(firstPoint.observedAt)) / msPerDay
        )
    );

    if (deltaValue === 0) {
        return {
            deltaLabel: `Flat • ${rangeDays}d`,
            points,
            summaryLabel: `${params.metricLabel} is flat over ${rangeDays} days`,
            tone: 'neutral',
        };
    }

    const tone: ShopMetricSparklineTone = deltaValue > 0 ? 'up' : 'down';
    const deltaMagnitudeLabel = toCompactNumberLabel(Math.abs(deltaValue));
    const signedDeltaLabel = `${deltaValue > 0 ? '+' : '-'}${deltaMagnitudeLabel}`;

    return {
        deltaLabel: `${signedDeltaLabel} • ${rangeDays}d`,
        points,
        summaryLabel: `${params.metricLabel} changed ${signedDeltaLabel} over ${rangeDays} days`,
        tone,
    };
};
