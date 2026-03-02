import { useId } from 'react';
import { cn } from '@/lib/utils';

export interface ShopMetricSparklinePoint {
    observedAt: string;
    value: number | null;
}

export type ShopMetricSparklineTone = 'up' | 'down' | 'neutral';

interface CartesianPoint {
    x: number;
    y: number;
}

const chartHeight = 34;
const chartWidth = 140;
const xPadding = 3;
const yPadding = 4;

const toneClassByTone: Record<ShopMetricSparklineTone, { fill: string; stroke: string }> = {
    up: {
        fill: 'fill-terminal-green/15',
        stroke: 'stroke-terminal-green',
    },
    down: {
        fill: 'fill-terminal-red/15',
        stroke: 'stroke-terminal-red',
    },
    neutral: {
        fill: 'fill-terminal-blue/15',
        stroke: 'stroke-terminal-blue',
    },
};

const toCartesianPoints = (
    points: ShopMetricSparklinePoint[]
): {
    hasObservedData: boolean;
    points: CartesianPoint[];
    yBaseline: number;
} => {
    const hasObservedData = points.some((point) => point.value !== null);

    if (points.length === 0) {
        return {
            hasObservedData,
            points: [],
            yBaseline: chartHeight - yPadding,
        };
    }

    const resolvedValues = points.map((point) => point.value ?? 0);

    if (resolvedValues.length === 0) {
        return {
            hasObservedData,
            points: [],
            yBaseline: chartHeight - yPadding,
        };
    }

    const minValue = Math.min(...resolvedValues);
    const maxValue = Math.max(...resolvedValues);
    const denominator = maxValue - minValue;
    const xSpan = chartWidth - xPadding * 2;
    const ySpan = chartHeight - yPadding * 2;

    if (points.length === 1) {
        return {
            hasObservedData,
            points: [
                {
                    x: chartWidth / 2,
                    y:
                        denominator === 0
                            ? chartHeight / 2
                            : yPadding +
                              ySpan -
                              ((resolvedValues[0] - minValue) / denominator) * ySpan,
                },
            ],
            yBaseline: chartHeight - yPadding,
        };
    }

    return {
        hasObservedData,
        points: points.map((point, index) => {
            const value = point.value ?? 0;
            const x = xPadding + (xSpan * index) / (points.length - 1);
            const y =
                denominator === 0
                    ? chartHeight / 2
                    : yPadding + ySpan - ((value - minValue) / denominator) * ySpan;

            return { x, y };
        }),
        yBaseline: chartHeight - yPadding,
    };
};

const toPathValue = (points: CartesianPoint[]): string => {
    if (points.length === 0) {
        return '';
    }

    return points
        .map(
            (point, index) =>
                `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
        )
        .join(' ');
};

const toAreaPathValue = (params: { points: CartesianPoint[]; yBaseline: number }): string => {
    if (params.points.length === 0) {
        return '';
    }

    const linePath = toPathValue(params.points);
    const firstPoint = params.points[0];
    const lastPoint = params.points.at(-1);

    if (!(firstPoint && lastPoint)) {
        return '';
    }

    return `${linePath} L ${lastPoint.x.toFixed(2)} ${params.yBaseline.toFixed(2)} L ${firstPoint.x.toFixed(2)} ${params.yBaseline.toFixed(2)} Z`;
};

export function ShopMetricSparkline(props: {
    ariaLabel: string;
    points: ShopMetricSparklinePoint[];
    summaryLabel: string;
    tone: ShopMetricSparklineTone;
}) {
    const gradientId = useId().replace(/:/g, '');
    const classes = toneClassByTone[props.tone];
    const { hasObservedData, points, yBaseline } = toCartesianPoints(props.points);
    const linePath = toPathValue(points);
    const areaPath = toAreaPathValue({
        points,
        yBaseline,
    });
    const hasUsableData = hasObservedData && points.length >= 2;

    return (
        <svg
            aria-label={props.ariaLabel}
            className="block h-8 w-full"
            preserveAspectRatio="none"
            role="img"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
            <title>{props.summaryLabel}</title>
            <defs>
                <linearGradient id={`trend-${gradientId}`} x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.42" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                </linearGradient>
            </defs>
            {hasUsableData ? (
                <>
                    <path
                        className={cn(classes.fill)}
                        d={areaPath}
                        fill={`url(#trend-${gradientId})`}
                        stroke="none"
                    />
                    <path
                        className={cn(classes.stroke)}
                        d={linePath}
                        fill="none"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                    />
                </>
            ) : (
                <line
                    className="stroke-terminal-dim/70"
                    strokeDasharray="2 2"
                    strokeWidth="1.25"
                    x1={xPadding}
                    x2={chartWidth - xPadding}
                    y1={chartHeight / 2}
                    y2={chartHeight / 2}
                />
            )}
        </svg>
    );
}
