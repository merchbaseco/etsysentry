import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SummaryCountProps {
    fallbackText?: string;
    isLoading: boolean;
    minWidthClassName: string;
    skeletonWidthClassName: string;
    value: number | undefined;
    valueClassName?: string;
}

const COUNT_ANIMATION_DURATION_MS = 240;

const useAnimatedCount = (value: number | undefined): number | undefined => {
    const [displayValue, setDisplayValue] = useState<number | undefined>(value);
    const previousValueRef = useRef<number | undefined>(value);

    useEffect(() => {
        if (typeof value !== 'number') {
            setDisplayValue(undefined);
            previousValueRef.current = value;
            return;
        }

        const startValue =
            typeof previousValueRef.current === 'number' ? previousValueRef.current : value;

        if (startValue === value) {
            setDisplayValue(value);
            previousValueRef.current = value;
            return;
        }

        let frameId = 0;
        const startedAt = performance.now();

        const animate = (timestamp: number) => {
            const progress = Math.min((timestamp - startedAt) / COUNT_ANIMATION_DURATION_MS, 1);
            const nextValue = Math.round(startValue + (value - startValue) * progress);
            setDisplayValue(nextValue);

            if (progress < 1) {
                frameId = window.requestAnimationFrame(animate);
                return;
            }

            previousValueRef.current = value;
        };

        frameId = window.requestAnimationFrame(animate);

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [value]);

    return displayValue;
};

export const SummaryCount = ({
    isLoading,
    minWidthClassName,
    skeletonWidthClassName,
    value,
    fallbackText = '--',
    valueClassName,
}: SummaryCountProps) => {
    const displayValue = useAnimatedCount(value);

    if (typeof displayValue !== 'number' && isLoading) {
        return <Skeleton className={cn('h-2.5 rounded-sm', skeletonWidthClassName)} />;
    }

    if (typeof displayValue !== 'number') {
        return (
            <span
                className={cn(
                    'inline-block text-right tabular-nums',
                    minWidthClassName,
                    valueClassName
                )}
            >
                {fallbackText}
            </span>
        );
    }

    return (
        <span
            className={cn(
                'inline-block text-right tabular-nums',
                minWidthClassName,
                valueClassName
            )}
        >
            {displayValue}
        </span>
    );
};
