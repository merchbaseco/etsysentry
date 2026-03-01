import { useCallback, useEffect, useState } from 'react';
import { useAdminStatus } from '@/hooks/use-admin-status';
import { useCurrencyStatus } from '@/hooks/use-currency-status';
import { useEnqueueSyncAllListings } from '@/hooks/use-enqueue-sync-all-listings';
import { useEtsyApiUsage } from '@/hooks/use-etsy-api-usage';
import { useListingRefreshPolicy } from '@/hooks/use-listing-refresh-policy';
import { useRefreshCurrencyRates } from '@/hooks/use-refresh-currency-rates';
import type { EtsyApiUsage } from '@/lib/admin-api';
import type { CurrencyStatus } from '@/lib/currency-api';
import type { GetListingRefreshPolicyOutput } from '@/lib/listings-api';
import { toTrpcRequestError } from '@/lib/trpc-http';
import {
    formatCurrencyErrorMessage,
    formatEtsyApiUsageErrorMessage,
    formatListingRefreshPolicyErrorMessage,
    formatListingResyncErrorMessage,
    type SettingsPage,
} from './shared';
import { useApiKeysSettingsState } from './use-api-keys-settings-state';

interface UseSettingsModalStateParams {
    activePage: SettingsPage;
    open: boolean;
    setActivePage: (page: SettingsPage) => void;
}

interface UseSettingsModalStateOutput {
    activeApiKey: ReturnType<typeof useApiKeysSettingsState>['activeApiKey'];
    adminEnqueueMessage: string | null;
    adminErrorMessage: string | null;
    apiKeyErrorMessage: string | null;
    apiUsage: EtsyApiUsage | null;
    apiUsageErrorMessage: string | null;
    currencyErrorMessage: string | null;
    currencyStatus: CurrencyStatus | null;
    handleEnqueueListingResync: () => Promise<void>;
    handleRefreshCurrencyRates: () => Promise<void>;
    hasAdminAccess: boolean;
    isEnqueuingListingResync: boolean;
    isLoadingApiKey: boolean;
    isLoadingApiUsage: boolean;
    isLoadingCurrencyStatus: boolean;
    isLoadingListingRefreshPolicy: boolean;
    isRefreshingCurrencyRates: boolean;
    isRotatingApiKey: boolean;
    listingRefreshPolicy: GetListingRefreshPolicyOutput | null;
    listingRefreshPolicyErrorMessage: string | null;
    loadApiKey: () => Promise<void>;
    loadApiUsage: () => Promise<void>;
    loadListingRefreshPolicy: () => Promise<void>;
    rawApiKey: string | null;
    rotateApiKey: () => Promise<void>;
}

export const useSettingsModalState = ({
    activePage,
    open,
    setActivePage,
}: UseSettingsModalStateParams): UseSettingsModalStateOutput => {
    const currencyStatusQuery = useCurrencyStatus({
        enabled: false,
    });
    const refreshCurrencyRatesMutation = useRefreshCurrencyRates();
    const adminStatusQuery = useAdminStatus({
        enabled: false,
    });
    const etsyApiUsageQuery = useEtsyApiUsage({
        enabled: false,
    });
    const listingRefreshPolicyQuery = useListingRefreshPolicy({
        enabled: false,
    });
    const enqueueSyncAllListingsMutation = useEnqueueSyncAllListings();
    const refetchCurrencyStatus = currencyStatusQuery.refetch;
    const refreshCurrencyRates = refreshCurrencyRatesMutation.mutateAsync;
    const refetchAdminStatus = adminStatusQuery.refetch;
    const refetchEtsyApiUsage = etsyApiUsageQuery.refetch;
    const refetchListingRefreshPolicy = listingRefreshPolicyQuery.refetch;
    const enqueueSyncAllListings = enqueueSyncAllListingsMutation.mutateAsync;
    const [currencyStatus, setCurrencyStatus] = useState<CurrencyStatus | null>(null);
    const [currencyErrorMessage, setCurrencyErrorMessage] = useState<string | null>(null);
    const [listingRefreshPolicy, setListingRefreshPolicy] =
        useState<GetListingRefreshPolicyOutput | null>(null);
    const [listingRefreshPolicyErrorMessage, setListingRefreshPolicyErrorMessage] = useState<
        string | null
    >(null);

    const [isAdmin, setIsAdmin] = useState(false);
    const [apiUsage, setApiUsage] = useState<EtsyApiUsage | null>(null);
    const [apiUsageErrorMessage, setApiUsageErrorMessage] = useState<string | null>(null);
    const [adminEnqueueMessage, setAdminEnqueueMessage] = useState<string | null>(null);
    const [adminErrorMessage, setAdminErrorMessage] = useState<string | null>(null);

    const {
        activeApiKey,
        apiKeyErrorMessage,
        isLoadingApiKey,
        isRotatingApiKey,
        loadApiKey,
        rawApiKey,
        rotateApiKey,
    } = useApiKeysSettingsState({
        activePage,
        open,
    });

    const isLoadingCurrencyStatus = currencyStatusQuery.isFetching;
    const isRefreshingCurrencyRates = refreshCurrencyRatesMutation.isPending;
    const isLoadingAdminStatus = adminStatusQuery.isFetching;
    const isLoadingApiUsage = etsyApiUsageQuery.isFetching;
    const isLoadingListingRefreshPolicy = listingRefreshPolicyQuery.isFetching;
    const isEnqueuingListingResync = enqueueSyncAllListingsMutation.isPending;
    const hasAdminAccess = isAdmin && !isLoadingAdminStatus;

    const loadCurrencyStatus = useCallback(async () => {
        try {
            const result = await refetchCurrencyStatus();
            const status = result.data;

            if (!status) {
                throw result.error ?? new Error('Failed to load currency status.');
            }

            setCurrencyStatus(status);
            setCurrencyErrorMessage(null);
        } catch (error) {
            setCurrencyErrorMessage(formatCurrencyErrorMessage(error));
        }
    }, [refetchCurrencyStatus]);

    const handleRefreshCurrencyRates = useCallback(async () => {
        try {
            const status = await refreshCurrencyRates();
            setCurrencyStatus(status);
            setCurrencyErrorMessage(null);
        } catch (error) {
            setCurrencyErrorMessage(formatCurrencyErrorMessage(error));
        }
    }, [refreshCurrencyRates]);

    const loadAdminPrivileges = useCallback(async () => {
        try {
            const result = await refetchAdminStatus();

            if (result.data) {
                setIsAdmin(true);
                return;
            }

            throw result.error ?? new Error('Failed to load admin status.');
        } catch (error) {
            const requestError = toTrpcRequestError(error);

            if (requestError.code === 'FORBIDDEN' || requestError.code === 'UNAUTHORIZED') {
                setIsAdmin(false);
                return;
            }

            setIsAdmin(false);
        }
    }, [refetchAdminStatus]);

    const loadApiUsage = useCallback(async () => {
        if (!hasAdminAccess) {
            return;
        }

        try {
            const result = await refetchEtsyApiUsage();
            const usage = result.data;

            if (!usage) {
                throw result.error ?? new Error('Failed to load Etsy API usage.');
            }

            setApiUsage(usage);
            setApiUsageErrorMessage(null);
        } catch (error) {
            setApiUsageErrorMessage(formatEtsyApiUsageErrorMessage(error));
        }
    }, [hasAdminAccess, refetchEtsyApiUsage]);

    const loadListingRefreshPolicy = useCallback(async () => {
        try {
            const result = await refetchListingRefreshPolicy();
            const refreshPolicy = result.data;

            if (!refreshPolicy) {
                throw result.error ?? new Error('Failed to load listing refresh policy.');
            }

            setListingRefreshPolicy(refreshPolicy);
            setListingRefreshPolicyErrorMessage(null);
        } catch (error) {
            setListingRefreshPolicyErrorMessage(formatListingRefreshPolicyErrorMessage(error));
        }
    }, [refetchListingRefreshPolicy]);

    const handleEnqueueListingResync = useCallback(async () => {
        if (!hasAdminAccess || isEnqueuingListingResync) {
            return;
        }

        try {
            const response = await enqueueSyncAllListings();

            let summary = 'No tracked listings were found to enqueue.';
            if (response.totalCount !== 0) {
                if (response.skippedCount === 0) {
                    summary = `Queued ${response.enqueuedCount} listing resync jobs.`;
                } else {
                    summary =
                        `Queued ${response.enqueuedCount} of ${response.totalCount}` +
                        ' listing resync jobs.';
                }
            }

            setAdminEnqueueMessage(summary);
            setAdminErrorMessage(null);
        } catch (error) {
            setAdminEnqueueMessage(null);
            setAdminErrorMessage(formatListingResyncErrorMessage(error));
        }
    }, [enqueueSyncAllListings, hasAdminAccess, isEnqueuingListingResync]);

    useEffect(() => {
        if (!open || activePage !== 'currency') {
            return;
        }

        loadCurrencyStatus();
    }, [activePage, loadCurrencyStatus, open]);

    useEffect(() => {
        if (!open) {
            return;
        }

        loadAdminPrivileges();
    }, [loadAdminPrivileges, open]);

    useEffect(() => {
        if (!open || (activePage !== 'etsy-api' && activePage !== 'api-keys') || !hasAdminAccess) {
            return;
        }

        loadApiUsage();
    }, [activePage, hasAdminAccess, loadApiUsage, open]);

    useEffect(() => {
        if (!open || activePage !== 'etsy-api') {
            return;
        }

        loadListingRefreshPolicy();
    }, [activePage, loadListingRefreshPolicy, open]);

    useEffect(() => {
        if (activePage !== 'admin' || hasAdminAccess || isLoadingAdminStatus) {
            return;
        }

        setActivePage('general');
    }, [activePage, hasAdminAccess, isLoadingAdminStatus, setActivePage]);

    useEffect(() => {
        if (open) {
            return;
        }

        setApiUsage(null);
        setApiUsageErrorMessage(null);
        setAdminEnqueueMessage(null);
        setAdminErrorMessage(null);
        setListingRefreshPolicy(null);
        setListingRefreshPolicyErrorMessage(null);
    }, [open]);

    return {
        activeApiKey,
        adminErrorMessage,
        adminEnqueueMessage,
        apiKeyErrorMessage,
        apiUsage,
        apiUsageErrorMessage,
        currencyErrorMessage,
        currencyStatus,
        handleEnqueueListingResync,
        handleRefreshCurrencyRates,
        hasAdminAccess,
        isEnqueuingListingResync,
        isLoadingApiKey,
        isLoadingApiUsage,
        isLoadingCurrencyStatus,
        isLoadingListingRefreshPolicy,
        isRefreshingCurrencyRates,
        isRotatingApiKey,
        listingRefreshPolicy,
        listingRefreshPolicyErrorMessage,
        loadApiKey,
        loadApiUsage,
        loadListingRefreshPolicy,
        rawApiKey,
        rotateApiKey,
    };
};
