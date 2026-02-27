import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    dataRowClassName,
    formatDurationMs,
    formatElapsedSinceTimestamp,
    sectionBarClassName,
    sectionBarLabelClassName,
    wideButtonClassName,
} from '@/components/settings/shared';
import type { EtsyApiUsage } from '@/lib/admin-api';
import { cn } from '@/lib/utils';

interface EtsyApiAdminSectionProps {
    apiUsage: EtsyApiUsage | null;
    apiUsageErrorMessage: string | null;
    isLoadingApiUsage: boolean;
    onRefreshApiUsage: () => Promise<void>;
}

const formatRemainingOverLimit = (params: {
    limit: number | undefined;
    remaining: number | null | undefined;
}): string => {
    if (params.limit === undefined || params.remaining === null || params.remaining === undefined) {
        return 'N/A';
    }

    return `${params.remaining}/${params.limit}`;
};

const formatTimestampWithResolvedTimeZone = (value: string | null): string => {
    if (!value) {
        return 'N/A';
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return 'N/A';
    }

    const resolvedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return parsed.toLocaleString(undefined, {
        timeZone: resolvedTimeZone,
        timeZoneName: 'short',
    });
};

export const EtsyApiAdminSection = ({
    apiUsage,
    apiUsageErrorMessage,
    isLoadingApiUsage,
    onRefreshApiUsage,
}: EtsyApiAdminSectionProps) => {
    const [nowMs, setNowMs] = useState<number>(() => Date.now());

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setNowMs(Date.now());
        }, 1000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    return (
        <>
            <div className={sectionBarClassName}>
                <span className={sectionBarLabelClassName}>API Usage</span>
            </div>

            <div className={dataRowClassName}>
                <span className="text-muted-foreground text-xs">Last refreshed</span>
                <span className="font-medium text-foreground text-xs">
                    {apiUsage ? `${formatElapsedSinceTimestamp(apiUsage.fetchedAt, nowMs)}` : 'N/A'}
                </span>
            </div>
            <div className={dataRowClassName}>
                <span className="text-muted-foreground text-xs">Second quota</span>
                <span className="font-medium text-foreground text-xs">
                    {formatRemainingOverLimit({
                        limit: apiUsage?.rateLimit.perSecondLimit,
                        remaining: apiUsage?.rateLimit.remainingThisSecond,
                    })}
                </span>
            </div>
            <div className={dataRowClassName}>
                <span className="text-muted-foreground text-xs">Daily quota</span>
                <span className="font-medium text-foreground text-xs">
                    {formatRemainingOverLimit({
                        limit: apiUsage?.rateLimit.perDayLimit,
                        remaining: apiUsage?.rateLimit.remainingToday,
                    })}
                </span>
            </div>
            <div className={dataRowClassName}>
                <span className="text-muted-foreground text-xs">Current cooldown</span>
                <span className="font-medium text-foreground text-xs">
                    {apiUsage ? formatDurationMs(apiUsage.rateLimit.blockedForMs) : 'N/A'}
                </span>
            </div>
            <div className={dataRowClassName}>
                <span className="text-muted-foreground text-xs">Last refresh timestamp</span>
                <span className="font-medium text-foreground text-xs">
                    {formatTimestampWithResolvedTimeZone(apiUsage?.fetchedAt ?? null)}
                </span>
            </div>
            <div className={dataRowClassName}>
                <span className="text-muted-foreground text-xs">Last call</span>
                <span className="font-medium text-foreground text-xs">
                    {formatTimestampWithResolvedTimeZone(apiUsage?.stats.lastCallAt ?? null)}
                </span>
            </div>

            <button
                className={wideButtonClassName}
                disabled={isLoadingApiUsage}
                onClick={() => {
                    void onRefreshApiUsage();
                }}
                type="button"
            >
                <RefreshCw
                    className={cn('size-3', isLoadingApiUsage ? 'animate-spin' : undefined)}
                />
                Refresh Usage
            </button>

            {apiUsageErrorMessage ? (
                <div className="px-4 py-1.5">
                    <p className="text-terminal-red text-xs">{apiUsageErrorMessage}</p>
                </div>
            ) : null}
        </>
    );
};
