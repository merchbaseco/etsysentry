import { useCallback, useEffect, useRef, useState } from 'react';
import {
    disconnectEtsyAuth,
    getEtsyAuthStatus,
    refreshEtsyAuth,
    startEtsyAuth,
    type EtsyAuthStatus
} from '@/lib/etsy-auth-api';
import { TrpcRequestError } from '@/lib/trpc-http';

const OAUTH_SESSION_STORAGE_KEY = 'etsysentry.oauthSessionId';

const disconnectedStatus: EtsyAuthStatus = {
    connected: false,
    expiresAt: null,
    needsRefresh: false,
    scopes: []
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

const loadStoredSessionId = (): string | null => {
    try {
        return window.localStorage.getItem(OAUTH_SESSION_STORAGE_KEY);
    } catch {
        return null;
    }
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
        'scrollbars=yes'
    ].join(',');
};

const trimSessionId = (oauthSessionId: string | null): string | null => {
    if (!oauthSessionId) {
        return null;
    }

    const prefix = oauthSessionId.slice(0, 8);
    const suffix = oauthSessionId.slice(-6);

    if (oauthSessionId.length <= 16) {
        return oauthSessionId;
    }

    return `${prefix}...${suffix}`;
};

export type EtsyOAuthConnectionState = {
    checkStatus: () => Promise<void>;
    connected: boolean;
    connect: () => Promise<void>;
    errorMessage: string | null;
    expiresAt: string | null;
    forgetSession: () => Promise<void>;
    hasSession: boolean;
    isCheckingStatus: boolean;
    isConnecting: boolean;
    isDisconnecting: boolean;
    isRefreshing: boolean;
    needsRefresh: boolean;
    oauthSessionId: string | null;
    refreshConnection: () => Promise<void>;
    scopes: string[];
    sessionLabel: string | null;
};

export const useEtsyOAuthConnection = (): EtsyOAuthConnectionState => {
    const [oauthSessionId, setOauthSessionId] = useState<string | null>(null);
    const [status, setStatus] = useState<EtsyAuthStatus>(disconnectedStatus);
    const [isCheckingStatus, setIsCheckingStatus] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [hasHydratedStorage, setHasHydratedStorage] = useState(false);

    const popupRef = useRef<Window | null>(null);
    const popupCloseWatcherRef = useRef<number | null>(null);

    const persistSessionId = useCallback((nextSessionId: string | null) => {
        setOauthSessionId(nextSessionId);

        try {
            if (nextSessionId) {
                window.localStorage.setItem(OAUTH_SESSION_STORAGE_KEY, nextSessionId);
            } else {
                window.localStorage.removeItem(OAUTH_SESSION_STORAGE_KEY);
            }
        } catch {
            // Ignore storage write failures.
        }
    }, []);

    const fetchStatus = useCallback(
        async (
            sessionId: string,
            options: {
                silent?: boolean;
            } = {}
        ): Promise<EtsyAuthStatus | null> => {
            if (!options.silent) {
                setIsCheckingStatus(true);
            }

            try {
                const nextStatus = await getEtsyAuthStatus({
                    oauthSessionId: sessionId
                });

                setStatus(nextStatus);
                setErrorMessage(null);
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
        []
    );

    const stopPopupWatcher = useCallback(() => {
        if (popupCloseWatcherRef.current !== null) {
            window.clearInterval(popupCloseWatcherRef.current);
            popupCloseWatcherRef.current = null;
        }
    }, []);

    const pollForConnection = useCallback(
        async (sessionId: string): Promise<void> => {
            const timeoutMs = 90_000;
            const intervalMs = 1_500;
            const deadline = Date.now() + timeoutMs;

            while (Date.now() < deadline) {
                const nextStatus = await fetchStatus(sessionId, { silent: true });

                if (nextStatus?.connected) {
                    return;
                }

                await wait(intervalMs);
            }
        },
        [fetchStatus]
    );

    const startPopupWatcher = useCallback(
        (sessionId: string) => {
            stopPopupWatcher();

            popupCloseWatcherRef.current = window.setInterval(() => {
                if (!popupRef.current?.closed) {
                    return;
                }

                popupRef.current = null;
                stopPopupWatcher();
                void fetchStatus(sessionId, { silent: true });
            }, 500);
        },
        [fetchStatus, stopPopupWatcher]
    );

    const checkStatus = useCallback(async () => {
        if (!oauthSessionId) {
            setStatus(disconnectedStatus);
            return;
        }

        await fetchStatus(oauthSessionId);
    }, [fetchStatus, oauthSessionId]);

    const connect = useCallback(async () => {
        setIsConnecting(true);
        setErrorMessage(null);

        try {
            const flow = await startEtsyAuth();
            persistSessionId(flow.oauthSessionId);
            setStatus(disconnectedStatus);

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
            startPopupWatcher(flow.oauthSessionId);
            void pollForConnection(flow.oauthSessionId);
        } catch (connectError) {
            setErrorMessage(formatErrorMessage(connectError));
        } finally {
            setIsConnecting(false);
        }
    }, [persistSessionId, pollForConnection, startPopupWatcher]);

    const refreshConnection = useCallback(async () => {
        if (!oauthSessionId) {
            setErrorMessage('No OAuth session is active. Connect first.');
            return;
        }

        setIsRefreshing(true);
        setErrorMessage(null);

        try {
            const nextStatus = await refreshEtsyAuth({ oauthSessionId });
            setStatus(nextStatus);
        } catch (refreshError) {
            setErrorMessage(formatErrorMessage(refreshError));
        } finally {
            setIsRefreshing(false);
        }
    }, [oauthSessionId]);

    const forgetSession = useCallback(async () => {
        if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close();
        }

        popupRef.current = null;
        stopPopupWatcher();

        setIsDisconnecting(true);

        let disconnectErrorMessage: string | null = null;

        try {
            if (oauthSessionId) {
                await disconnectEtsyAuth({ oauthSessionId });
            }
        } catch (disconnectError) {
            disconnectErrorMessage = formatErrorMessage(disconnectError);
        } finally {
            persistSessionId(null);
            setStatus(disconnectedStatus);
            setErrorMessage(disconnectErrorMessage);
            setIsDisconnecting(false);
        }
    }, [oauthSessionId, persistSessionId, stopPopupWatcher]);

    useEffect(() => {
        const storedSessionId = loadStoredSessionId();

        if (storedSessionId) {
            setOauthSessionId(storedSessionId);
        }

        setHasHydratedStorage(true);
    }, []);

    useEffect(() => {
        if (!hasHydratedStorage) {
            return;
        }

        if (!oauthSessionId) {
            setStatus(disconnectedStatus);
            return;
        }

        void fetchStatus(oauthSessionId);
    }, [fetchStatus, hasHydratedStorage, oauthSessionId]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;

            if (!message || typeof message !== 'object' || message.type !== 'etsy-oauth-complete') {
                return;
            }

            if (popupRef.current && event.source && event.source !== popupRef.current) {
                return;
            }

            if (!oauthSessionId) {
                return;
            }

            void pollForConnection(oauthSessionId);
        };

        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [oauthSessionId, pollForConnection]);

    useEffect(() => {
        return () => {
            stopPopupWatcher();
        };
    }, [stopPopupWatcher]);

    return {
        checkStatus,
        connected: status.connected,
        connect,
        errorMessage,
        expiresAt: status.expiresAt,
        forgetSession,
        hasSession: oauthSessionId !== null,
        isCheckingStatus,
        isConnecting,
        isDisconnecting,
        isRefreshing,
        needsRefresh: status.needsRefresh,
        oauthSessionId,
        refreshConnection,
        scopes: status.scopes,
        sessionLabel: trimSessionId(oauthSessionId)
    };
};
