import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { verifyToken } from '@clerk/backend';
import type { FastifyInstance } from 'fastify';
import { WebSocket, WebSocketServer } from 'ws';
import { env } from '../../config/env';
import {
    onEvent,
    type RealtimeInvalidationEvent
} from './emit-event';

type RealtimeConnectionIdentity = {
    clerkUserId: string;
    tenantId: string;
};

const normalizeOrigin = (origin: string): string => {
    return origin.trim().replace(/\/+$/, '');
};

const parsePathname = (request: IncomingMessage): string => {
    const url = new URL(request.url ?? '', 'http://localhost');
    return url.pathname;
};

const parseToken = (request: IncomingMessage): string | null => {
    const url = new URL(request.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token')?.trim();

    if (!token) {
        return null;
    }

    return token;
};

const isAllowedOrigin = (request: IncomingMessage): boolean => {
    const requestOrigin = request.headers.origin;

    if (!requestOrigin) {
        return true;
    }

    return normalizeOrigin(requestOrigin) === normalizeOrigin(env.APP_ORIGIN);
};

const rejectUpgrade = (socket: Socket, statusLine: string): void => {
    if (socket.destroyed) {
        return;
    }

    socket.write(`HTTP/1.1 ${statusLine}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
};

const deriveIdentityFromToken = async (
    token: string
): Promise<RealtimeConnectionIdentity | null> => {
    try {
        const payload = await verifyToken(token, {
            secretKey: env.CLERK_SECRET_KEY
        });

        const subject = typeof payload.sub === 'string' ? payload.sub.trim() : '';

        if (!subject) {
            return null;
        }

        const orgId = typeof payload.org_id === 'string' ? payload.org_id.trim() : '';
        const tenantId = orgId.length > 0 ? orgId : subject;

        return {
            clerkUserId: subject,
            tenantId
        };
    } catch {
        return null;
    }
};

const shouldDeliverEvent = (
    event: RealtimeInvalidationEvent,
    connectionIdentity: RealtimeConnectionIdentity
): boolean => {
    return (
        event.clerkUserId === connectionIdentity.clerkUserId &&
        event.tenantId === connectionIdentity.tenantId
    );
};

export const startWebsocketRuntime = (params: {
    server: FastifyInstance;
}): {
    stop: () => Promise<void>;
} => {
    const websocketServer = new WebSocketServer({
        noServer: true
    });
    const identityByConnection = new Map<WebSocket, RealtimeConnectionIdentity>();
    const removeInvalidationListener = onEvent((event) => {
        const payload = JSON.stringify({
            queries: event.queries,
            type: 'query.invalidate'
        });

        for (const [connection, connectionIdentity] of identityByConnection.entries()) {
            if (!shouldDeliverEvent(event, connectionIdentity)) {
                continue;
            }

            if (connection.readyState !== WebSocket.OPEN) {
                continue;
            }

            connection.send(payload, (error?: Error) => {
                if (!error) {
                    return;
                }

                params.server.log.warn(
                    {
                        clerkUserId: event.clerkUserId,
                        error,
                        tenantId: event.tenantId
                    },
                    'Failed to send realtime invalidation event.'
                );
            });
        }
    });

    const onUpgrade = (request: IncomingMessage, socket: Socket, head: Buffer) => {
        if (parsePathname(request) !== '/ws') {
            return;
        }

        if (!isAllowedOrigin(request)) {
            rejectUpgrade(socket, '403 Forbidden');
            return;
        }

        const token = parseToken(request);

        if (!token) {
            rejectUpgrade(socket, '401 Unauthorized');
            return;
        }

        void deriveIdentityFromToken(token).then((connectionIdentity) => {
            if (!connectionIdentity) {
                rejectUpgrade(socket, '401 Unauthorized');
                return;
            }

            if (socket.destroyed) {
                return;
            }

            websocketServer.handleUpgrade(request, socket, head, (connection: WebSocket) => {
                identityByConnection.set(connection, connectionIdentity);
                websocketServer.emit('connection', connection, request);
            });
        });
    };

    websocketServer.on('connection', (connection: WebSocket) => {
        connection.on('close', () => {
            identityByConnection.delete(connection);
        });

        connection.on('error', () => {
            identityByConnection.delete(connection);
        });
    });

    params.server.server.on('upgrade', onUpgrade);

    return {
        stop: async () => {
            params.server.server.off('upgrade', onUpgrade);
            removeInvalidationListener();

            for (const connection of websocketServer.clients) {
                connection.close();
            }

            await new Promise<void>((resolve) => {
                websocketServer.close(() => {
                    resolve();
                });
            });

            identityByConnection.clear();
        }
    };
};
