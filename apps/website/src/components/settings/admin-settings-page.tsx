import { RefreshCw } from 'lucide-react';
import {
    dataRowClassName,
    formatDurationMs,
    formatTimestamp,
    sectionBarClassName,
    sectionBarLabelClassName,
    wideButtonClassName,
} from '@/components/settings/shared';
import type { EtsyApiUsage } from '@/lib/admin-api';
import { cn } from '@/lib/utils';

interface AdminSettingsPageProps {
    apiUsage: EtsyApiUsage | null;
    apiUsageErrorMessage: string | null;
    enqueueErrorMessage: string | null;
    enqueueMessage: string | null;
    isEnqueuingListingResync: boolean;
    isLoadingApiUsage: boolean;
    onEnqueueListingResync: () => Promise<void>;
    onRefreshApiUsage: () => Promise<void>;
}

export const AdminSettingsPage = ({
    apiUsage,
    apiUsageErrorMessage,
    enqueueMessage,
    enqueueErrorMessage,
    isEnqueuingListingResync,
    isLoadingApiUsage,
    onEnqueueListingResync,
    onRefreshApiUsage,
}: AdminSettingsPageProps) => {
    return (
        <div>
            <div className={sectionBarClassName}>
                <span className={sectionBarLabelClassName}>Listing Operations</span>
            </div>

            <div className="px-4 py-2">
                <p className="text-muted-foreground text-xs">
                    Queue a full resync for all tracked listings in this tenant.
                </p>
            </div>

            <button
                className={cn(wideButtonClassName, 'border-t')}
                disabled={isEnqueuingListingResync}
                onClick={() => {
                    onEnqueueListingResync();
                }}
                type="button"
            >
                <RefreshCw
                    className={cn('size-3', isEnqueuingListingResync ? 'animate-spin' : undefined)}
                />
                Enqueue Listing Resync
            </button>

            {enqueueMessage ? (
                <div className="px-4 py-1.5">
                    <p className="text-terminal-green text-xs">{enqueueMessage}</p>
                </div>
            ) : null}

            {enqueueErrorMessage ? (
                <div className="px-4 py-1.5">
                    <p className="text-terminal-red text-xs">{enqueueErrorMessage}</p>
                </div>
            ) : null}

            <div className={sectionBarClassName}>
                <span className={sectionBarLabelClassName}>Etsy API Usage</span>
            </div>

            <div className={dataRowClassName}>
                <span className="text-muted-foreground text-xs">Per-day limit</span>
                <span className="font-medium text-foreground text-xs">
                    {apiUsage?.rateLimit.perDayLimit ?? 'N/A'}
                </span>
            </div>
            <div className={dataRowClassName}>
                <span className="text-muted-foreground text-xs">Calls (24h)</span>
                <span className="font-medium text-foreground text-xs">
                    {apiUsage?.stats.callsPast24Hours ?? 'N/A'}
                </span>
            </div>
            <div className={dataRowClassName}>
                <span className="text-muted-foreground text-xs">Calls (1h)</span>
                <span className="font-medium text-foreground text-xs">
                    {apiUsage?.stats.callsPastHour ?? 'N/A'}
                </span>
            </div>
            <div className={dataRowClassName}>
                <span className="text-muted-foreground text-xs">Current cooldown</span>
                <span className="font-medium text-foreground text-xs">
                    {apiUsage ? formatDurationMs(apiUsage.rateLimit.blockedForMs) : 'N/A'}
                </span>
            </div>
            <div className={cn(dataRowClassName, 'border-b-0')}>
                <span className="text-muted-foreground text-xs">Last call</span>
                <span className="font-medium text-foreground text-xs">
                    {formatTimestamp(apiUsage?.stats.lastCallAt ?? null)}
                </span>
            </div>

            <button
                className={cn(wideButtonClassName, 'border-t')}
                disabled={isLoadingApiUsage}
                onClick={() => {
                    onRefreshApiUsage();
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
        </div>
    );
};
