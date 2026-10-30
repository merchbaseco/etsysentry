import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { WebSocket, WebSocketServer } from 'ws';
import type { EtsySentryAccess } from '../access/etsysentry-access';
import { onRealtimeEvent } from './emit-event';

interface RealtimeConnectionIdentity {
    accountId: string;
    expiresAt: number | null;
    merchbaseUserId: string;
}

interface ManagedConnection {
    expiryTimer: NodeJS.Timeout | null;
    identity: RealtimeConnectionIdentity;
}

const parseRequestUrl = (request: IncomingMessage): URL =>
    new URL(request.url ?? '', `http://${request.headers.host ?? 'localhost'}`);

const parseAssertion = (request: IncomingMessage): string | undefined => {
    const assertion = request.headers['cf-access-jwt-assertion'];
    return typeof assertion === 'string' && assertion.length > 0 ? assertion : undefined;
};

const parseUserIdHeader = (request: IncomingMessage): string | string[] | undefined =>
    request.headers['x-merchbase-user-id'];

const rejectUpgrade = (socket: Socket, statusLine: string): void => {
    if (socket.destroyed) {
        return;
    }

    socket.write(`HTTP/1.1 ${statusLine}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
};

const getConnectionIdentity = async (
    request: IncomingMessage,
    access: EtsySentryAccess
): Promise<RealtimeConnectionIdentity | null> => {
    try {
        const authorized = await access.authorizeRequest({
            assertion: parseAssertion(request),
            host: request.headers.host,
            method: 'GET',
            upgrade: true,
            origin: request.headers.origin,
            userIdHeader: parseUserIdHeader(request),
        });

        return {
            accountId: authorized.principal.accountId,
            expiresAt: authorized.expiresAt,
            merchbaseUserId: authorized.merchbaseUserId,
        };
    } catch {
        return null;
    }
};

const shouldDeliverEvent = (
    eventAccountId: string,
    connectionIdentity: RealtimeConnectionIdentity
): boolean => eventAccountId === connectionIdentity.accountId;

export const startWebsocketRuntime = (params: {
    access: EtsySentryAccess;
    server: FastifyInstance;
}): {
    closeForUser: (merchbaseUserId: string) => void;
    stop: () => Promise<void>;
} => {
    const websocketServer = new WebSocketServer({ noServer: true });
    const managedConnections = new Map<WebSocket, ManagedConnection>();
    const closeConnection = (connection: WebSocket, code: number, reason: string): void => {
        const managed = managedConnections.get(connection);
        if (!managed) {
            return;
        }
        managedConnections.delete(connection);
        if (managed.expiryTimer) {
            clearTimeout(managed.expiryTimer);
        }
        if (
            connection.readyState === WebSocket.OPEN ||
            connection.readyState === WebSocket.CONNECTING
        ) {
            connection.close(code, reason);
        }
    };

    const removeInvalidationListener = onRealtimeEvent((event) => {
        for (const [connection, managed] of managedConnections.entries()) {
            if (!shouldDeliverEvent(event.accountId, managed.identity)) {
                continue;
            }

            if (connection.readyState !== WebSocket.OPEN) {
                continue;
            }

            connection.send(event.payload, (error?: Error) => {
                if (!error) {
                    return;
                }

                params.server.log.warn(
                    { error, accountId: event.accountId },
                    'Failed to send realtime invalidation event.'
                );
            });
        }
    });

    const onUpgrade = (request: IncomingMessage, socket: Socket, head: Buffer) => {
        let url: URL;
        try {
            url = parseRequestUrl(request);
        } catch {
            return;
        }
        if (url.pathname !== '/ws') {
            return;
        }
        if (url.search !== '') {
            rejectUpgrade(socket, '400 Bad Request');
            return;
        }

        getConnectionIdentity(request, params.access).then((identity) => {
            if (!identity || socket.destroyed) {
                rejectUpgrade(socket, '401 Unauthorized');
                return;
            }

            websocketServer.handleUpgrade(request, socket, head, (connection: WebSocket) => {
                const managed: ManagedConnection = { identity, expiryTimer: null };
                if (identity.expiresAt !== null) {
                    const remainingMs = identity.expiresAt - Date.now();
                    if (remainingMs <= 0) {
                        connection.close(4001, 'Access expired');
                        return;
                    }
                    managed.expiryTimer = setTimeout(() => {
                        closeConnection(connection, 4001, 'Access expired');
                    }, remainingMs);
                    managed.expiryTimer.unref();
                }
                managedConnections.set(connection, managed);
                websocketServer.emit('connection', connection, request);
            });
        });
    };

    websocketServer.on('connection', (connection: WebSocket) => {
        connection.on('close', () => {
            closeConnection(connection, 1000, 'Closed');
        });

        connection.on('error', () => {
            closeConnection(connection, 1011, 'Socket error');
        });
    });

    params.server.server.on('upgrade', onUpgrade);

    return {
        closeForUser: (merchbaseUserId) => {
            for (const [connection, managed] of managedConnections.entries()) {
                if (managed.identity.merchbaseUserId === merchbaseUserId) {
                    closeConnection(connection, 4001, 'Access changed');
                }
            }
        },
        stop: async () => {
            params.server.server.off('upgrade', onUpgrade);
            removeInvalidationListener();

            for (const connection of websocketServer.clients) {
                closeConnection(connection, 1001, 'Server stopping');
            }

            await new Promise<void>((resolve) => {
                websocketServer.close(() => resolve());
            });
            managedConnections.clear();
        },
    };
};
