import { useEffect, useState } from 'react';
import { createRealtimeEventHandler } from '@/hooks/realtime-handlers/handle-realtime-event';
import { parseRealtimeMessage } from '@/lib/realtime-message-types';

export const logsInvalidatedEventName = 'etsysentry:logs-invalidated';
export const listingsInvalidatedEventName = 'etsysentry:listings-invalidated';

export type RealtimeWebsocketStatus =
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'error'
    | 'reconnecting';

export interface RealtimeWebsocketState {
    lastConnectedAt: string | null;
    lastErrorAt: string | null;
    reconnectAttempt: number;
    status: RealtimeWebsocketStatus;
}

export const buildRealtimeWebsocketUrl = (): string => {
    const url = new URL(window.location.origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    url.search = '';

    return url.toString();
};

export const useRealtimeQueryInvalidations = (): RealtimeWebsocketState => {
    const [state, setState] = useState<RealtimeWebsocketState>({
        lastConnectedAt: null,
        lastErrorAt: null,
        reconnectAttempt: 0,
        status: 'disconnected',
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

            const delayMs = Math.min(1000 * 2 ** reconnectAttempt, 10_000);
            reconnectAttempt += 1;
            setState((current) => ({
                ...current,
                reconnectAttempt,
                status: 'reconnecting',
            }));

            reconnectTimeoutId = window.setTimeout(() => {
                reconnectTimeoutId = null;
                connect();
            }, delayMs);
        };

        const connect = () => {
            if (isStopped) {
                return;
            }

            setState((current) => ({
                ...current,
                status: reconnectAttempt > 0 ? 'reconnecting' : 'connecting',
            }));
            websocket = new WebSocket(buildRealtimeWebsocketUrl());

            websocket.onopen = () => {
                reconnectAttempt = 0;
                setState((current) => ({
                    ...current,
                    lastConnectedAt: new Date().toISOString(),
                    reconnectAttempt: 0,
                    status: 'connected',
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
                        status: 'disconnected',
                    }));
                    return;
                }

                scheduleReconnect();
            };

            websocket.onerror = () => {
                setState((current) => ({
                    ...current,
                    lastErrorAt: new Date().toISOString(),
                    status: 'error',
                }));
                websocket?.close();
            };
        };

        connect();

        return () => {
            isStopped = true;

            if (reconnectTimeoutId !== null) {
                window.clearTimeout(reconnectTimeoutId);
            }

            realtimeEventHandler.cleanup();
            websocket?.close();
            setState((current) => ({
                ...current,
                status: 'disconnected',
            }));
        };
    }, []);

    return state;
};
