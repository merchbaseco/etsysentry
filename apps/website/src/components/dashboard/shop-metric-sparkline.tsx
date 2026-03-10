import { type CSSProperties, type RefObject, useEffect, useRef, useState } from 'react';
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
    containerRef: RefObject<HTMLDivElement | null>;
    coordinate?: {
        x?: number;
        y?: number;
    };
    metricLabel: string;
    payload?: Array<{ payload?: SparklineChartPoint }>;
    tone: ShopMetricSparklineTone;
    valueFormatter: ShopMetricSparklineValueFormatter;
}

interface SparklineTooltipPortalPosition {
    left: number;
    top: number;
}

interface SparklineTooltipPortalPositionInput {
    containerBounds: {
        left: number;
        top: number;
    };
    coordinate?: {
        x?: number;
    };
}

const sparklineDateFormatter = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
});
const SPARKLINE_TOOLTIP_HORIZONTAL_OFFSET_PX = 12;
const SPARKLINE_TOOLTIP_VERTICAL_ANCHOR_PX = 28;
const SPARKLINE_TOOLTIP_VERTICAL_GAP_PX = 6;
const SPARKLINE_TOOLTIP_PORTAL_ATTRIBUTE = 'data-shop-metric-sparkline-tooltip-portal';
const sparklineTooltipPortalWrapperStyle: CSSProperties = {
    inset: 0,
    overflow: 'visible',
    pointerEvents: 'none',
    position: 'absolute',
};

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

export const getSparklineTooltipPortalPosition = ({
    containerBounds,
    coordinate,
}: SparklineTooltipPortalPositionInput): SparklineTooltipPortalPosition | null => {
    if (coordinate?.x === undefined) {
        return null;
    }

    return {
        left: containerBounds.left + coordinate.x + SPARKLINE_TOOLTIP_HORIZONTAL_OFFSET_PX,
        top: containerBounds.top + SPARKLINE_TOOLTIP_VERTICAL_ANCHOR_PX,
    };
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
    const point = props.payload?.[0]?.payload;
    const containerBounds = props.containerRef.current?.getBoundingClientRect();
    const tooltipPosition =
        containerBounds === undefined
            ? null
            : getSparklineTooltipPortalPosition({
                  containerBounds,
                  coordinate: props.coordinate,
              });

    if (!(props.active && point && tooltipPosition)) {
        return null;
    }

    return (
        <div
            style={{
                left: 0,
                pointerEvents: 'none',
                position: 'absolute',
                top: 0,
                transform:
                    `translate3d(${tooltipPosition.left}px, ${tooltipPosition.top}px, 0) ` +
                    `translateY(calc(-100% - ${SPARKLINE_TOOLTIP_VERTICAL_GAP_PX}px))`,
            }}
        >
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
    const containerRef = useRef<HTMLDivElement>(null);
    const [tooltipPortal, setTooltipPortal] = useState<HTMLElement | null>(null);
    const toneClasses = toneClassByTone[props.tone];
    const resolvedValueFormatter = props.valueFormatter ?? defaultValueFormatter;
    const chartData = toSparklineChartData(props.points);
    const hasUsableData = hasUsableSparklineData(chartData);
    const topMargin = props.chartTopMargin ?? 2;

    useEffect(() => {
        const portalNode = document.createElement('div');
        portalNode.setAttribute(SPARKLINE_TOOLTIP_PORTAL_ATTRIBUTE, 'true');
        portalNode.style.inset = '0';
        portalNode.style.pointerEvents = 'none';
        portalNode.style.position = 'fixed';
        portalNode.style.zIndex = '80';
        document.body.appendChild(portalNode);
        setTooltipPortal(portalNode);

        return () => {
            portalNode.remove();
        };
    }, []);

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
        <div aria-label={props.ariaLabel} className="h-full w-full" ref={containerRef} role="img">
            <ResponsiveContainer height="100%" width="100%">
                <AreaChart
                    data={chartData}
                    margin={{ bottom: 4, left: 0, right: 0, top: topMargin }}
                >
                    <Tooltip
                        allowEscapeViewBox={{ x: true, y: true }}
                        content={
                            <SparklineTooltipContent
                                containerRef={containerRef}
                                metricLabel={props.metricLabel}
                                tone={props.tone}
                                valueFormatter={resolvedValueFormatter}
                            />
                        }
                        cursor={<SparklineCursor />}
                        isAnimationActive={false}
                        offset={SPARKLINE_TOOLTIP_HORIZONTAL_OFFSET_PX}
                        portal={tooltipPortal}
                        wrapperStyle={sparklineTooltipPortalWrapperStyle}
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
