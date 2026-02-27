import { RefreshCw } from 'lucide-react';
import {
    dataRowClassName,
    formatTimestamp,
    sectionBarClassName,
    sectionBarLabelClassName,
    wideButtonClassName,
} from '@/components/settings/shared';
import type { CurrencyStatus } from '@/lib/currency-api';
import { cn } from '@/lib/utils';

interface CurrencySettingsPageProps {
    errorMessage: string | null;
    isLoadingStatus: boolean;
    isRefreshingRates: boolean;
    onRefreshRates: () => Promise<void>;
    status: CurrencyStatus | null;
}

export const CurrencySettingsPage = ({
    errorMessage,
    isLoadingStatus,
    isRefreshingRates,
    onRefreshRates,
    status,
}: CurrencySettingsPageProps) => {
    const syncErrorMessage = status?.lastRefreshError ?? null;
    const visibleErrorMessage = errorMessage ?? syncErrorMessage;

    return (
        <div>
            <div className={sectionBarClassName}>
                <span className={sectionBarLabelClassName}>Sync Schedule</span>
            </div>

            <div className={dataRowClassName}>
                <span className="text-muted-foreground text-xs">Last sync</span>
                <span className="font-medium text-foreground text-xs">
                    {formatTimestamp(status?.fetchedAt ?? null)}
                </span>
            </div>
            <div className={cn(dataRowClassName, 'border-b-0')}>
                <span className="text-muted-foreground text-xs">Next refresh</span>
                <span className="font-medium text-foreground text-xs">
                    {formatTimestamp(status?.nextRefreshAt ?? null)}
                </span>
            </div>

            <button
                className={cn(wideButtonClassName, 'border-t')}
                disabled={isRefreshingRates || isLoadingStatus}
                onClick={() => {
                    onRefreshRates();
                }}
                type="button"
            >
                <RefreshCw
                    className={cn('size-3', isRefreshingRates ? 'animate-spin' : undefined)}
                />
                Refresh Rates
            </button>

            {isLoadingStatus ? (
                <div className="px-4 py-1.5">
                    <p className="text-muted-foreground text-xs">Loading current rate status...</p>
                </div>
            ) : null}

            {visibleErrorMessage ? (
                <div className="px-4 py-1.5">
                    <p className="text-terminal-red text-xs">{visibleErrorMessage}</p>
                </div>
            ) : null}
        </div>
    );
};
