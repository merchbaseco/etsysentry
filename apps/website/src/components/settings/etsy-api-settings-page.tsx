import { CheckCircle2, RefreshCw, Unplug } from 'lucide-react';
import { EtsyApiAdminSection } from '@/components/settings/etsy-api-admin-section';
import {
    dataRowClassName,
    sectionBarClassName,
    sectionBarLabelClassName,
    wideButtonClassName,
    wideDangerButtonClassName,
} from '@/components/settings/shared';
import type { EtsyOAuthConnectionState } from '@/hooks/use-etsy-oauth-connection';
import type { EtsyApiUsage } from '@/lib/admin-api';
import type { GetListingRefreshPolicyOutput } from '@/lib/listings-api';
import { cn } from '@/lib/utils';

const getConnectionStatusLabel = (connection: EtsyOAuthConnectionState): string => {
    if (connection.connected && connection.needsRefresh) {
        return 'Connected (refresh recommended)';
    }

    if (connection.connected) {
        return 'Connected';
    }

    return 'Disconnected';
};

interface EtsyApiSettingsPageProps {
    apiUsage: EtsyApiUsage | null;
    apiUsageErrorMessage: string | null;
    connection: EtsyOAuthConnectionState;
    hasAdminAccess: boolean;
    isLoadingApiUsage: boolean;
    isLoadingListingRefreshPolicy: boolean;
    listingRefreshPolicy: GetListingRefreshPolicyOutput | null;
    listingRefreshPolicyErrorMessage: string | null;
    onRefreshApiUsage: () => Promise<void>;
    onRefreshListingRefreshPolicy: () => Promise<void>;
}

export const EtsyApiSettingsPage = ({
    apiUsage,
    apiUsageErrorMessage,
    connection,
    hasAdminAccess,
    isLoadingApiUsage,
    isLoadingListingRefreshPolicy,
    listingRefreshPolicy,
    listingRefreshPolicyErrorMessage,
    onRefreshApiUsage,
    onRefreshListingRefreshPolicy,
}: EtsyApiSettingsPageProps) => {
    const isActionBusy = connection.isCheckingStatus || connection.isDisconnecting;

    return (
        <div>
            <div className={cn(sectionBarClassName, 'border-b-0')}>
                <span className={sectionBarLabelClassName}>Connection</span>
                <span
                    className={cn(
                        'rounded font-medium',
                        'px-1 py-0 text-[10px]',
                        'uppercase tracking-wider',
                        connection.connected
                            ? 'bg-terminal-green/10 text-terminal-green'
                            : 'bg-terminal-yellow/10 text-terminal-yellow'
                    )}
                >
                    {getConnectionStatusLabel(connection)}
                </span>
            </div>

            <div className="grid grid-cols-2 border-border border-t">
                <button
                    className={cn(wideButtonClassName, 'border-r')}
                    disabled={isActionBusy}
                    onClick={() => {
                        void connection.checkStatus();
                    }}
                    type="button"
                >
                    <CheckCircle2 className="size-3" />
                    Check Status
                </button>
                <button
                    className={wideDangerButtonClassName}
                    disabled={isActionBusy || !connection.connected}
                    onClick={() => {
                        void connection.forgetSession();
                    }}
                    type="button"
                >
                    <Unplug className="size-3" />
                    Forget Session
                </button>
            </div>

            {connection.errorMessage ? (
                <div className="px-4 py-1.5">
                    <p className="text-terminal-red text-xs">{connection.errorMessage}</p>
                </div>
            ) : null}

            {hasAdminAccess ? (
                <EtsyApiAdminSection
                    apiUsage={apiUsage}
                    apiUsageErrorMessage={apiUsageErrorMessage}
                    isLoadingApiUsage={isLoadingApiUsage}
                    onRefreshApiUsage={onRefreshApiUsage}
                />
            ) : null}

            <div className={sectionBarClassName}>
                <span className={sectionBarLabelClassName}>Listing Refresh</span>
            </div>

            {listingRefreshPolicy?.buckets.length ? (
                listingRefreshPolicy.buckets.map((bucket, index) => (
                    <div
                        className={cn(
                            dataRowClassName,
                            index === listingRefreshPolicy.buckets.length - 1
                                ? 'border-b-0'
                                : undefined
                        )}
                        key={bucket.bucketId}
                    >
                        <span className="text-muted-foreground text-xs">{bucket.bucket}</span>
                        <span className="font-medium text-foreground text-xs">
                            {bucket.count.toLocaleString()}
                        </span>
                    </div>
                ))
            ) : (
                <div className={cn(dataRowClassName, 'border-b-0')}>
                    <span className="text-muted-foreground text-xs">
                        {isLoadingListingRefreshPolicy ? 'Loading...' : 'No bucket data'}
                    </span>
                </div>
            )}

            <button
                className={cn(wideButtonClassName, 'border-t')}
                disabled={isLoadingListingRefreshPolicy}
                onClick={() => {
                    void onRefreshListingRefreshPolicy();
                }}
                type="button"
            >
                <RefreshCw
                    className={cn(
                        'size-3',
                        isLoadingListingRefreshPolicy ? 'animate-spin' : undefined
                    )}
                />
                Refresh Policy
            </button>

            {listingRefreshPolicyErrorMessage ? (
                <div className="px-4 py-1.5">
                    <p className="text-terminal-red text-xs">{listingRefreshPolicyErrorMessage}</p>
                </div>
            ) : null}
        </div>
    );
};
