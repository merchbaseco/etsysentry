import { useEffect } from 'react';
import { queryClient, trpc } from '@/lib/trpc-client';

type RealtimeInvalidationQuery = 'app.keywords.list' | 'app.listings.list';

type RealtimeInvalidationMessage = {
    queries: RealtimeInvalidationQuery[];
    type: 'query.invalidate';
};

type AuthTokenGetter = () => Promise<string | null>;

const queryKeyByInvalidationQuery: Record<RealtimeInvalidationQuery, readonly unknown[]> = {
    'app.keywords.list': trpc.app.keywords.list.queryOptions({}).queryKey,
    'app.listings.list': trpc.app.listings.list.queryOptions({}).queryKey
};

const parseRealtimeInvalidationMessage = (rawData: unknown): RealtimeInvalidationMessage | null => {
    if (typeof rawData !== 'string') {
        return null;
    }

    try {
        const parsed = JSON.parse(rawData) as {
            queries?: unknown;
            type?: unknown;
        };

        if (parsed.type !== 'query.invalidate' || !Array.isArray(parsed.queries)) {
            return null;
        }

        const queries = parsed.queries.filter((query): query is RealtimeInvalidationQuery => {
            return query === 'app.keywords.list' || query === 'app.listings.list';
        });

        if (queries.length === 0) {
            return null;
        }

        return {
            queries,
            type: 'query.invalidate'
        };
    } catch {
        return null;
    }
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

const refetchInvalidatedQueries = async (queries: RealtimeInvalidationQuery[]): Promise<void> => {
    const uniqueQueries = Array.from(new Set(queries));

    await Promise.all(
        uniqueQueries.map(async (queryName) => {
            const queryKey = queryKeyByInvalidationQuery[queryName];

            await queryClient.invalidateQueries({
                queryKey
            });
            await queryClient.refetchQueries({
                queryKey,
                type: 'all'
            });
        })
    );
};

export const useRealtimeQueryInvalidations = (getAuthToken: AuthTokenGetter): void => {
    useEffect(() => {
        let websocket: WebSocket | null = null;
        let reconnectTimeoutId: number | null = null;
        let isStopped = false;
        let reconnectAttempt = 0;

        const scheduleReconnect = () => {
            if (isStopped || reconnectTimeoutId !== null) {
                return;
            }

            const delayMs = Math.min(1_000 * 2 ** reconnectAttempt, 10_000);
            reconnectAttempt += 1;

            reconnectTimeoutId = window.setTimeout(() => {
                reconnectTimeoutId = null;
                void connect();
            }, delayMs);
        };

        const connect = async () => {
            if (isStopped) {
                return;
            }

            const authToken = await getAuthToken();

            if (!authToken) {
                scheduleReconnect();
                return;
            }

            websocket = new WebSocket(buildRealtimeWebsocketUrl(authToken));

            websocket.onopen = () => {
                reconnectAttempt = 0;
            };

            websocket.onmessage = (event) => {
                const message = parseRealtimeInvalidationMessage(event.data);

                if (!message) {
                    return;
                }

                void refetchInvalidatedQueries(message.queries);
            };

            websocket.onclose = () => {
                websocket = null;

                if (isStopped) {
                    return;
                }

                scheduleReconnect();
            };

            websocket.onerror = () => {
                websocket?.close();
            };
        };

        void connect();

        return () => {
            isStopped = true;

            if (reconnectTimeoutId !== null) {
                window.clearTimeout(reconnectTimeoutId);
            }

            websocket?.close();
        };
    }, [getAuthToken]);
};
