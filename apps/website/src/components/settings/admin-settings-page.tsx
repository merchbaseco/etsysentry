import { RefreshCw } from 'lucide-react';
import type { EtsyApiUsage } from '@/lib/admin-api';
import { cn } from '@/lib/utils';
import {
    dataRowClassName,
    formatDurationMs,
    formatTimestamp,
    sectionBarClassName,
    sectionBarLabelClassName,
    wideButtonClassName
} from '@/components/settings/shared';

type AdminSettingsPageProps = {
    apiUsage: EtsyApiUsage | null;
    apiUsageErrorMessage: string | null;
    enqueueMessage: string | null;
    enqueueErrorMessage: string | null;
    isEnqueuingListingResync: boolean;
    isLoadingApiUsage: boolean;
    onEnqueueListingResync: () => Promise<void>;
    onRefreshApiUsage: () => Promise<void>;
};

export const AdminSettingsPage = ({
    apiUsage,
    apiUsageErrorMessage,
    enqueueMessage,
    enqueueErrorMessage,
    isEnqueuingListingResync,
    isLoadingApiUsage,
    onEnqueueListingResync,
    onRefreshApiUsage
}: AdminSettingsPageProps) => {
    return (
        <div>
            <div className={sectionBarClassName}>
                <span className={sectionBarLabelClassName}>Listing Operations</span>
            </div>

            <div className="px-4 py-2">
                <p className="text-xs text-muted-foreground">
                    Queue a full resync for all tracked listings in this tenant.
                </p>
            </div>

            <button
                type="button"
                className={wideButtonClassName}
                disabled={isEnqueuingListingResync}
                onClick={() => {
                    void onEnqueueListingResync();
                }}
            >
                <RefreshCw
                    className={cn(
                        'size-3',
                        isEnqueuingListingResync ? 'animate-spin' : undefined
                    )}
                />
                Enqueue Listing Resync
            </button>

            {enqueueMessage ? (
                <div className="px-4 py-1.5">
                    <p className="text-xs text-terminal-green">{enqueueMessage}</p>
                </div>
            ) : null}

            {enqueueErrorMessage ? (
                <div className="px-4 py-1.5">
                    <p className="text-xs text-terminal-red">{enqueueErrorMessage}</p>
                </div>
            ) : null}

            <div className={sectionBarClassName}>
                <span className={sectionBarLabelClassName}>Etsy API Usage</span>
            </div>

            <div className={dataRowClassName}>
                <span className="text-xs text-muted-foreground">Per-day limit</span>
                <span className="text-xs font-medium text-foreground">
                    {apiUsage?.rateLimit.perDayLimit ?? 'N/A'}
                </span>
            </div>
            <div className={dataRowClassName}>
                <span className="text-xs text-muted-foreground">Calls (24h)</span>
                <span className="text-xs font-medium text-foreground">
                    {apiUsage?.stats.callsPast24Hours ?? 'N/A'}
                </span>
            </div>
            <div className={dataRowClassName}>
                <span className="text-xs text-muted-foreground">Calls (1h)</span>
                <span className="text-xs font-medium text-foreground">
                    {apiUsage?.stats.callsPastHour ?? 'N/A'}
                </span>
            </div>
            <div className={dataRowClassName}>
                <span className="text-xs text-muted-foreground">Current cooldown</span>
                <span className="text-xs font-medium text-foreground">
                    {apiUsage
                        ? formatDurationMs(apiUsage.rateLimit.blockedForMs)
                        : 'N/A'}
                </span>
            </div>
            <div className={cn(dataRowClassName, 'border-b-0')}>
                <span className="text-xs text-muted-foreground">Last call</span>
                <span className="text-xs font-medium text-foreground">
                    {formatTimestamp(apiUsage?.stats.lastCallAt ?? null)}
                </span>
            </div>

            <button
                type="button"
                className={cn(wideButtonClassName, 'border-t')}
                disabled={isLoadingApiUsage}
                onClick={() => {
                    void onRefreshApiUsage();
                }}
            >
                <RefreshCw
                    className={cn(
                        'size-3',
                        isLoadingApiUsage ? 'animate-spin' : undefined
                    )}
                />
                Refresh Usage
            </button>

            {apiUsageErrorMessage ? (
                <div className="px-4 py-1.5">
                    <p className="text-xs text-terminal-red">
                        {apiUsageErrorMessage}
                    </p>
                </div>
            ) : null}
        </div>
    );
};
