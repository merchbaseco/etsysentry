import { useCallback, useEffect, useRef, useState } from 'react';
import { useDisconnectEtsyAuth } from '@/hooks/use-disconnect-etsy-auth';
import { useEtsyAuthStatus } from '@/hooks/use-etsy-auth-status';
import { useRefreshEtsyAuth } from '@/hooks/use-refresh-etsy-auth';
import { useStartEtsyAuth } from '@/hooks/use-start-etsy-auth';
import type { EtsyAuthStatus } from '@/lib/etsy-auth-api';
import { TrpcRequestError } from '@/lib/trpc-http';

const disconnectedStatus: EtsyAuthStatus = {
    connected: false,
    expiresAt: null,
    needsRefresh: false,
    scopes: [],
};

const wait = async (ms: number): Promise<void> => {
    await new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
};

const formatErrorMessage = (error: unknown): string => {
    if (error instanceof TrpcRequestError) {
        return error.message;
    }

    if (error instanceof Error && error.message.length > 0) {
        return error.message;
    }

    return 'Unexpected OAuth error. Please retry.';
};

const buildPopupFeatures = (): string => {
    const popupWidth = 640;
    const popupHeight = 760;
    const left = Math.max(window.screenX + (window.outerWidth - popupWidth) / 2, 0);
    const top = Math.max(window.screenY + (window.outerHeight - popupHeight) / 2, 0);

    return [
        `width=${popupWidth}`,
        `height=${popupHeight}`,
        `left=${Math.floor(left)}`,
        `top=${Math.floor(top)}`,
        'resizable=yes',
        'scrollbars=yes',
    ].join(',');
};

export interface EtsyOAuthConnectionState {
    checkStatus: () => Promise<void>;
    connect: () => Promise<void>;
    connected: boolean;
    errorMessage: string | null;
    expiresAt: string | null;
    forgetSession: () => Promise<void>;
    hasSession: boolean;
    isCheckingStatus: boolean;
    isConnecting: boolean;
    isDisconnecting: boolean;
    isRefreshing: boolean;
    needsRefresh: boolean;
    refreshConnection: () => Promise<void>;
    scopes: string[];
    sessionLabel: string | null;
}

export const useEtsyOAuthConnection = (): EtsyOAuthConnectionState => {
    const etsyAuthStatusQuery = useEtsyAuthStatus({
        enabled: false,
    });
    const startEtsyAuthMutation = useStartEtsyAuth();
    const refreshEtsyAuthMutation = useRefreshEtsyAuth();
    const disconnectEtsyAuthMutation = useDisconnectEtsyAuth();
    const refetchEtsyAuthStatus = etsyAuthStatusQuery.refetch;
    const startEtsyAuth = startEtsyAuthMutation.mutateAsync;
    const refreshEtsyAuth = refreshEtsyAuthMutation.mutateAsync;
    const disconnectEtsyAuth = disconnectEtsyAuthMutation.mutateAsync;
    const [status, setStatus] = useState<EtsyAuthStatus>(disconnectedStatus);
    const [isCheckingStatus, setIsCheckingStatus] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPendingConnection, setIsPendingConnection] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const popupRef = useRef<Window | null>(null);
    const popupCloseWatcherRef = useRef<number | null>(null);

    const fetchStatus = useCallback(
        async (options: { silent?: boolean } = {}): Promise<EtsyAuthStatus | null> => {
            if (!options.silent) {
                setIsCheckingStatus(true);
            }

            try {
                const result = await refetchEtsyAuthStatus();
                const nextStatus = result.data;

                if (!nextStatus) {
                    throw result.error ?? new Error('Failed to load Etsy OAuth status.');
                }

                setStatus(nextStatus);
                setErrorMessage(null);

                if (nextStatus.connected) {
                    setIsPendingConnection(false);
                }

                return nextStatus;
            } catch (statusError) {
                setStatus(disconnectedStatus);
                setErrorMessage(formatErrorMessage(statusError));
                return null;
            } finally {
                if (!options.silent) {
                    setIsCheckingStatus(false);
                }
            }
        },
        [refetchEtsyAuthStatus]
    );

    const stopPopupWatcher = useCallback(() => {
        if (popupCloseWatcherRef.current !== null) {
            window.clearInterval(popupCloseWatcherRef.current);
            popupCloseWatcherRef.current = null;
        }
    }, []);

    const pollForConnection = useCallback(async (): Promise<void> => {
        const timeoutMs = 90_000;
        const intervalMs = 1500;
        const deadline = Date.now() + timeoutMs;

        while (Date.now() < deadline) {
            const nextStatus = await fetchStatus({ silent: true });

            if (nextStatus?.connected) {
                return;
            }

            await wait(intervalMs);
        }

        setIsPendingConnection(false);
        await fetchStatus({ silent: true });
    }, [fetchStatus]);

    const startPopupWatcher = useCallback(() => {
        stopPopupWatcher();

        popupCloseWatcherRef.current = window.setInterval(() => {
            if (!popupRef.current?.closed) {
                return;
            }

            popupRef.current = null;
            stopPopupWatcher();
            setIsPendingConnection(false);
            fetchStatus({ silent: true });
        }, 500);
    }, [fetchStatus, stopPopupWatcher]);

    const checkStatus = useCallback(async () => {
        await fetchStatus();
    }, [fetchStatus]);

    const connect = useCallback(async () => {
        setIsConnecting(true);
        setErrorMessage(null);

        try {
            const flow = await startEtsyAuth();
            setStatus(disconnectedStatus);
            setIsPendingConnection(true);

            const popupWindow = window.open(
                flow.authorizationUrl,
                'etsy-oauth',
                buildPopupFeatures()
            );

            if (!popupWindow) {
                setErrorMessage('Popup was blocked. Continuing OAuth in this tab.');
                window.location.assign(flow.authorizationUrl);
                return;
            }

            popupRef.current = popupWindow;
            popupWindow.focus();
            startPopupWatcher();
            pollForConnection();
        } catch (connectError) {
            setErrorMessage(formatErrorMessage(connectError));
            setIsPendingConnection(false);
        } finally {
            setIsConnecting(false);
        }
    }, [pollForConnection, startEtsyAuth, startPopupWatcher]);

    const refreshConnection = useCallback(async () => {
        if (!status.connected) {
            setErrorMessage('Etsy OAuth is not connected. Connect first.');
            return;
        }

        setIsRefreshing(true);
        setErrorMessage(null);

        try {
            const nextStatus = await refreshEtsyAuth();
            setStatus(nextStatus);
        } catch (refreshError) {
            setErrorMessage(formatErrorMessage(refreshError));
        } finally {
            setIsRefreshing(false);
        }
    }, [refreshEtsyAuth, status.connected]);

    const forgetSession = useCallback(async () => {
        if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close();
        }

        popupRef.current = null;
        stopPopupWatcher();

        setIsDisconnecting(true);

        let disconnectErrorMessage: string | null = null;

        try {
            await disconnectEtsyAuth();
        } catch (disconnectError) {
            disconnectErrorMessage = formatErrorMessage(disconnectError);
        } finally {
            setStatus(disconnectedStatus);
            setIsPendingConnection(false);
            setErrorMessage(disconnectErrorMessage);
            setIsDisconnecting(false);
        }
    }, [disconnectEtsyAuth, stopPopupWatcher]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;

            if (!message || typeof message !== 'object' || message.type !== 'etsy-oauth-complete') {
                return;
            }

            if (popupRef.current && event.source && event.source !== popupRef.current) {
                return;
            }

            pollForConnection();
        };

        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [pollForConnection]);

    useEffect(() => {
        return () => {
            stopPopupWatcher();
        };
    }, [stopPopupWatcher]);

    const hasSession = status.connected || isPendingConnection;

    return {
        checkStatus,
        connected: status.connected,
        connect,
        errorMessage,
        expiresAt: status.expiresAt,
        forgetSession,
        hasSession,
        isCheckingStatus,
        isConnecting,
        isDisconnecting,
        isRefreshing,
        needsRefresh: status.needsRefresh,
        refreshConnection,
        scopes: status.scopes,
        sessionLabel: hasSession ? 'server-managed' : null,
    };
};
