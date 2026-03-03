import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatNumber } from '@/components/ui/dashboard';
import { cn } from '@/lib/utils';

export interface ShopMetricSparklinePoint {
    observedAt: string;
    value: number | null;
}

export type ShopMetricSparklineTone = 'up' | 'down' | 'neutral';
export type ShopMetricSparklineValueFormatter = (value: number | null) => string;

interface SparklineChartPoint {
    observedAt: string;
    resolvedValue: number;
    value: number | null;
}

interface SparklineTooltipContentProps {
    active?: boolean;
    metricLabel: string;
    payload?: Array<{ payload?: SparklineChartPoint }>;
    tone: ShopMetricSparklineTone;
    valueFormatter: ShopMetricSparklineValueFormatter;
}

const sparklineDateFormatter = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
});

const toneClassByTone: Record<
    ShopMetricSparklineTone,
    { accentBorder: string; seriesColor: string }
> = {
    up: {
        accentBorder: 'border-l-terminal-green',
        seriesColor: 'var(--terminal-green)',
    },
    down: {
        accentBorder: 'border-l-terminal-red',
        seriesColor: 'var(--terminal-red)',
    },
    neutral: {
        accentBorder: 'border-l-terminal-blue',
        seriesColor: 'var(--terminal-blue)',
    },
};

export const formatSparklineObservedDate = (observedAt: string): string => {
    const timestamp = Date.parse(observedAt);

    if (Number.isNaN(timestamp)) {
        return observedAt;
    }

    return sparklineDateFormatter.format(new Date(timestamp));
};

const defaultValueFormatter: ShopMetricSparklineValueFormatter = (value) => {
    if (value === null) {
        return '--';
    }

    return formatNumber(value);
};

export const toSparklineChartData = (points: ShopMetricSparklinePoint[]): SparklineChartPoint[] => {
    return points.map((point) => ({
        observedAt: point.observedAt,
        resolvedValue: point.value ?? 0,
        value: point.value,
    }));
};

const hasUsableSparklineData = (points: SparklineChartPoint[]): boolean => {
    return points.length >= 2 && points.some((point) => point.value !== null);
};

function SparklineCursor(props: {
    height?: number;
    points?: Array<{ x: number; y: number }>;
    top?: number;
}) {
    const x = props.points?.[0]?.x;
    if (x === undefined) {
        return null;
    }
    return (
        <line
            stroke="var(--foreground)"
            strokeDasharray="3 3"
            strokeOpacity={0.3}
            strokeWidth={1}
            x1={x}
            x2={x}
            y1={0}
            y2={(props.top ?? 0) + (props.height ?? 0) + 4}
        />
    );
}

function SparklineTooltipContent(props: SparklineTooltipContentProps) {
    const firstPayload = props.payload?.[0];
    const point = firstPayload?.payload;

    if (!(props.active && point)) {
        return null;
    }

    return (
        <div
            className={cn(
                'pointer-events-none border border-border border-l-2 bg-background px-2 py-1.5 text-left shadow-sm',
                toneClassByTone[props.tone].accentBorder
            )}
        >
            <p className="whitespace-nowrap font-mono font-semibold text-foreground text-sm tabular-nums">
                {props.metricLabel}: {props.valueFormatter(point.value)}
            </p>
            <p className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                {formatSparklineObservedDate(point.observedAt)}
            </p>
        </div>
    );
}

export function ShopMetricSparkline(props: {
    ariaLabel: string;
    chartTopMargin?: number;
    metricLabel: string;
    points: ShopMetricSparklinePoint[];
    tone: ShopMetricSparklineTone;
    valueFormatter?: ShopMetricSparklineValueFormatter;
}) {
    const toneClasses = toneClassByTone[props.tone];
    const resolvedValueFormatter = props.valueFormatter ?? defaultValueFormatter;
    const chartData = toSparklineChartData(props.points);
    const hasUsableData = hasUsableSparklineData(chartData);
    const topMargin = props.chartTopMargin ?? 2;

    if (!hasUsableData) {
        return (
            <svg
                aria-label={props.ariaLabel}
                className="block h-full w-full"
                preserveAspectRatio="none"
                role="img"
                viewBox="0 0 140 34"
            >
                <line
                    className="stroke-terminal-dim/70"
                    strokeDasharray="2 2"
                    strokeWidth="1.25"
                    x1="0"
                    x2="140"
                    y1="17"
                    y2="17"
                />
            </svg>
        );
    }

    return (
        <div aria-label={props.ariaLabel} className="h-full w-full" role="img">
            <ResponsiveContainer height="100%" width="100%">
                <AreaChart
                    data={chartData}
                    margin={{ bottom: 4, left: 0, right: 0, top: topMargin }}
                >
                    <Tooltip
                        content={
                            <SparklineTooltipContent
                                metricLabel={props.metricLabel}
                                tone={props.tone}
                                valueFormatter={resolvedValueFormatter}
                            />
                        }
                        cursor={<SparklineCursor />}
                        isAnimationActive={false}
                        offset={12}
                        position={{ y: 4 }}
                        wrapperStyle={{ outline: 'none', zIndex: 20 }}
                    />
                    <Area
                        activeDot={{
                            fill: 'var(--background)',
                            r: 3.5,
                            stroke: toneClasses.seriesColor,
                            strokeWidth: 2,
                        }}
                        dataKey="resolvedValue"
                        fill={toneClasses.seriesColor}
                        fillOpacity={0.12}
                        isAnimationActive={false}
                        stroke={toneClasses.seriesColor}
                        strokeWidth={1.5}
                        type="linear"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
