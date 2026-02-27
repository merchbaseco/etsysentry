import { useCallback, useEffect, useState } from 'react';
import {
    type EtsyApiUsage,
    enqueueSyncAllListings,
    getAdminStatus,
    getEtsyApiUsage,
} from '@/lib/admin-api';
import { type CurrencyStatus, getCurrencyStatus, refreshCurrencyRates } from '@/lib/currency-api';
import { toTrpcRequestError } from '@/lib/trpc-http';
import {
    formatCurrencyErrorMessage,
    formatEtsyApiUsageErrorMessage,
    formatListingResyncErrorMessage,
    type SettingsPage,
} from './shared';

interface UseSettingsModalStateParams {
    activePage: SettingsPage;
    open: boolean;
    setActivePage: (page: SettingsPage) => void;
}

interface UseSettingsModalStateOutput {
    adminEnqueueMessage: string | null;
    adminErrorMessage: string | null;
    apiUsage: EtsyApiUsage | null;
    apiUsageErrorMessage: string | null;
    currencyErrorMessage: string | null;
    currencyStatus: CurrencyStatus | null;
    handleEnqueueListingResync: () => Promise<void>;
    handleRefreshCurrencyRates: () => Promise<void>;
    hasAdminAccess: boolean;
    isEnqueuingListingResync: boolean;
    isLoadingApiUsage: boolean;
    isLoadingCurrencyStatus: boolean;
    isRefreshingCurrencyRates: boolean;
    loadApiUsage: () => Promise<void>;
}

export const useSettingsModalState = ({
    activePage,
    open,
    setActivePage,
}: UseSettingsModalStateParams): UseSettingsModalStateOutput => {
    const [currencyStatus, setCurrencyStatus] = useState<CurrencyStatus | null>(null);
    const [isLoadingCurrencyStatus, setIsLoadingCurrencyStatus] = useState(false);
    const [isRefreshingCurrencyRates, setIsRefreshingCurrencyRates] = useState(false);
    const [currencyErrorMessage, setCurrencyErrorMessage] = useState<string | null>(null);

    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoadingAdminStatus, setIsLoadingAdminStatus] = useState(false);
    const [apiUsage, setApiUsage] = useState<EtsyApiUsage | null>(null);
    const [isLoadingApiUsage, setIsLoadingApiUsage] = useState(false);
    const [apiUsageErrorMessage, setApiUsageErrorMessage] = useState<string | null>(null);
    const [isEnqueuingListingResync, setIsEnqueuingListingResync] = useState(false);
    const [adminEnqueueMessage, setAdminEnqueueMessage] = useState<string | null>(null);
    const [adminErrorMessage, setAdminErrorMessage] = useState<string | null>(null);

    const hasAdminAccess = isAdmin && !isLoadingAdminStatus;

    const loadCurrencyStatus = useCallback(async () => {
        setIsLoadingCurrencyStatus(true);

        try {
            const status = await getCurrencyStatus();
            setCurrencyStatus(status);
            setCurrencyErrorMessage(null);
        } catch (error) {
            setCurrencyErrorMessage(formatCurrencyErrorMessage(error));
        } finally {
            setIsLoadingCurrencyStatus(false);
        }
    }, []);

    const handleRefreshCurrencyRates = useCallback(async () => {
        setIsRefreshingCurrencyRates(true);

        try {
            const status = await refreshCurrencyRates();
            setCurrencyStatus(status);
            setCurrencyErrorMessage(null);
        } catch (error) {
            setCurrencyErrorMessage(formatCurrencyErrorMessage(error));
        } finally {
            setIsRefreshingCurrencyRates(false);
        }
    }, []);

    const loadAdminPrivileges = useCallback(async () => {
        setIsLoadingAdminStatus(true);

        try {
            await getAdminStatus();
            setIsAdmin(true);
        } catch (error) {
            const requestError = toTrpcRequestError(error);

            if (requestError.code === 'FORBIDDEN' || requestError.code === 'UNAUTHORIZED') {
                setIsAdmin(false);
                return;
            }

            setIsAdmin(false);
        } finally {
            setIsLoadingAdminStatus(false);
        }
    }, []);

    const loadApiUsage = useCallback(async () => {
        if (!hasAdminAccess) {
            return;
        }

        setIsLoadingApiUsage(true);

        try {
            const usage = await getEtsyApiUsage();
            setApiUsage(usage);
            setApiUsageErrorMessage(null);
        } catch (error) {
            setApiUsageErrorMessage(formatEtsyApiUsageErrorMessage(error));
        } finally {
            setIsLoadingApiUsage(false);
        }
    }, [hasAdminAccess]);

    const handleEnqueueListingResync = useCallback(async () => {
        if (!hasAdminAccess || isEnqueuingListingResync) {
            return;
        }

        setIsEnqueuingListingResync(true);

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
        } finally {
            setIsEnqueuingListingResync(false);
        }
    }, [hasAdminAccess, isEnqueuingListingResync]);

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
        if (!open || activePage !== 'admin' || !hasAdminAccess) {
            return;
        }

        loadApiUsage();
    }, [activePage, hasAdminAccess, loadApiUsage, open]);

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
    }, [open]);

    return {
        adminErrorMessage,
        adminEnqueueMessage,
        apiUsage,
        apiUsageErrorMessage,
        currencyErrorMessage,
        currencyStatus,
        handleEnqueueListingResync,
        handleRefreshCurrencyRates,
        hasAdminAccess,
        isEnqueuingListingResync,
        isLoadingApiUsage,
        isLoadingCurrencyStatus,
        isRefreshingCurrencyRates,
        loadApiUsage,
    };
};
