import { useEffect, useState } from 'react';
import {
    createRealtimeEventHandler
} from '@/hooks/realtime-handlers/handle-realtime-event';
import { parseRealtimeMessage } from '@/lib/realtime-message-types';

type AuthTokenGetter = () => Promise<string | null>;

export const logsInvalidatedEventName = 'etsysentry:logs-invalidated';
export const listingsInvalidatedEventName = 'etsysentry:listings-invalidated';

export type RealtimeWebsocketStatus =
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'error'
    | 'reconnecting'
    | 'waiting_for_auth';

export type RealtimeWebsocketState = {
    lastConnectedAt: string | null;
    lastErrorAt: string | null;
    reconnectAttempt: number;
    status: RealtimeWebsocketStatus;
};

const buildRealtimeWebsocketUrl = (token: string): string => {
    const configuredOrigin = (import.meta.env.VITE_SERVER_ORIGIN as string | undefined)?.trim();
    const origin = configuredOrigin?.length ? configuredOrigin : window.location.origin;
    const url = new URL(origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    url.search = '';
    url.searchParams.set('token', token);

    return url.toString();
};

export const useRealtimeQueryInvalidations = (
    getAuthToken: AuthTokenGetter
): RealtimeWebsocketState => {
    const [state, setState] = useState<RealtimeWebsocketState>({
        lastConnectedAt: null,
        lastErrorAt: null,
        reconnectAttempt: 0,
        status: 'disconnected'
    });

    useEffect(() => {
        let websocket: WebSocket | null = null;
        let reconnectTimeoutId: number | null = null;
        let isStopped = false;
        let reconnectAttempt = 0;
        const realtimeEventHandler = createRealtimeEventHandler();

        const scheduleReconnect = () => {
            if (isStopped || reconnectTimeoutId !== null) {
                return;
            }

            const delayMs = Math.min(1_000 * 2 ** reconnectAttempt, 10_000);
            reconnectAttempt += 1;
            setState((current) => ({
                ...current,
                reconnectAttempt,
                status: 'reconnecting'
            }));

            reconnectTimeoutId = window.setTimeout(() => {
                reconnectTimeoutId = null;
                void connect();
            }, delayMs);
        };

        const connect = async () => {
            if (isStopped) {
                return;
            }

            setState((current) => ({
                ...current,
                status: reconnectAttempt > 0 ? 'reconnecting' : 'connecting'
            }));
            const authToken = await getAuthToken();

            if (!authToken) {
                setState((current) => ({
                    ...current,
                    status: 'waiting_for_auth'
                }));
                scheduleReconnect();
                return;
            }

            websocket = new WebSocket(buildRealtimeWebsocketUrl(authToken));

            websocket.onopen = () => {
                reconnectAttempt = 0;
                setState((current) => ({
                    ...current,
                    lastConnectedAt: new Date().toISOString(),
                    reconnectAttempt: 0,
                    status: 'connected'
                }));
            };

            websocket.onmessage = (event) => {
                const message = parseRealtimeMessage(event.data);

                if (!message) {
                    return;
                }

                realtimeEventHandler.handleRealtimeEvent(message);
            };

            websocket.onclose = () => {
                websocket = null;

                if (isStopped) {
                    setState((current) => ({
                        ...current,
                        status: 'disconnected'
                    }));
                    return;
                }

                scheduleReconnect();
            };

            websocket.onerror = () => {
                setState((current) => ({
                    ...current,
                    lastErrorAt: new Date().toISOString(),
                    status: 'error'
                }));
                websocket?.close();
            };
        };

        void connect();

        return () => {
            isStopped = true;

            if (reconnectTimeoutId !== null) {
                window.clearTimeout(reconnectTimeoutId);
            }

            realtimeEventHandler.cleanup();
            websocket?.close();
            setState((current) => ({
                ...current,
                status: 'disconnected'
            }));
        };
    }, [getAuthToken]);

    return state;
};
