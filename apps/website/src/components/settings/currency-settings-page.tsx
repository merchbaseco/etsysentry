import { RefreshCw } from 'lucide-react';
import type { CurrencyStatus } from '@/lib/currency-api';
import { cn } from '@/lib/utils';
import {
    dataRowClassName,
    formatTimestamp,
    sectionBarClassName,
    sectionBarLabelClassName,
    wideButtonClassName
} from '@/components/settings/shared';

type CurrencySettingsPageProps = {
    errorMessage: string | null;
    isLoadingStatus: boolean;
    isRefreshingRates: boolean;
    onRefreshRates: () => Promise<void>;
    status: CurrencyStatus | null;
};

export const CurrencySettingsPage = ({
    errorMessage,
    isLoadingStatus,
    isRefreshingRates,
    onRefreshRates,
    status
}: CurrencySettingsPageProps) => {
    const syncErrorMessage = status?.lastRefreshError ?? null;
    const visibleErrorMessage = errorMessage ?? syncErrorMessage;

    return (
        <div>
            <div className={sectionBarClassName}>
                <span className={sectionBarLabelClassName}>Sync Schedule</span>
            </div>

            <div className={dataRowClassName}>
                <span className="text-xs text-muted-foreground">Last sync</span>
                <span className="text-xs font-medium text-foreground">
                    {formatTimestamp(status?.fetchedAt ?? null)}
                </span>
            </div>
            <div className={cn(dataRowClassName, 'border-b-0')}>
                <span className="text-xs text-muted-foreground">Next refresh</span>
                <span className="text-xs font-medium text-foreground">
                    {formatTimestamp(status?.nextRefreshAt ?? null)}
                </span>
            </div>

            <button
                type="button"
                className={cn(wideButtonClassName, 'border-t')}
                disabled={isRefreshingRates || isLoadingStatus}
                onClick={() => {
                    void onRefreshRates();
                }}
            >
                <RefreshCw
                    className={cn(
                        'size-3',
                        isRefreshingRates ? 'animate-spin' : undefined
                    )}
                />
                Refresh Rates
            </button>

            {isLoadingStatus ? (
                <div className="px-4 py-1.5">
                    <p className="text-xs text-muted-foreground">
                        Loading current rate status...
                    </p>
                </div>
            ) : null}

            {visibleErrorMessage ? (
                <div className="px-4 py-1.5">
                    <p className="text-xs text-terminal-red">{visibleErrorMessage}</p>
                </div>
            ) : null}
        </div>
    );
};
