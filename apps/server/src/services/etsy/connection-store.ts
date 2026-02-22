import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { etsyOAuthConnections } from '../../db/schema';

export type EtsyOAuthConnectionKey = {
    clerkUserId: string;
    tenantId: string;
};

export type EtsyOAuthTokens = {
    accessToken: string;
    expiresAt: Date;
    refreshToken: string;
    scopes: string[];
    tokenType: string;
};

export type EtsyOAuthConnectionStore = {
    clear: (key: EtsyOAuthConnectionKey) => Promise<void>;
    get: (key: EtsyOAuthConnectionKey) => Promise<EtsyOAuthTokens | null>;
    set: (key: EtsyOAuthConnectionKey, tokens: EtsyOAuthTokens) => Promise<void>;
};

export class InMemoryEtsyOAuthConnectionStore implements EtsyOAuthConnectionStore {
    private readonly tokensByConnection = new Map<string, EtsyOAuthTokens>();

    async clear(key: EtsyOAuthConnectionKey): Promise<void> {
        this.tokensByConnection.delete(this.toStorageKey(key));
    }

    async get(key: EtsyOAuthConnectionKey): Promise<EtsyOAuthTokens | null> {
        const tokens = this.tokensByConnection.get(this.toStorageKey(key));

        if (!tokens) {
            return null;
        }

        return {
            ...tokens,
            expiresAt: new Date(tokens.expiresAt.getTime()),
            scopes: [...tokens.scopes]
        };
    }

    async set(key: EtsyOAuthConnectionKey, tokens: EtsyOAuthTokens): Promise<void> {
        this.tokensByConnection.set(this.toStorageKey(key), {
            ...tokens,
            expiresAt: new Date(tokens.expiresAt.getTime()),
            scopes: [...tokens.scopes]
        });
    }

    private toStorageKey(key: EtsyOAuthConnectionKey): string {
        return `${key.tenantId}::${key.clerkUserId}`;
    }
}

export const etsyOAuthConnectionStore: EtsyOAuthConnectionStore = {
    async clear(key) {
        await db
            .delete(etsyOAuthConnections)
            .where(
                and(
                    eq(etsyOAuthConnections.tenantId, key.tenantId),
                    eq(etsyOAuthConnections.clerkUserId, key.clerkUserId)
                )
            );
    },
    async get(key) {
        const [row] = await db
            .select()
            .from(etsyOAuthConnections)
            .where(
                and(
                    eq(etsyOAuthConnections.tenantId, key.tenantId),
                    eq(etsyOAuthConnections.clerkUserId, key.clerkUserId)
                )
            )
            .limit(1);

        if (!row) {
            return null;
        }

        return {
            accessToken: row.accessToken,
            expiresAt: row.expiresAt,
            refreshToken: row.refreshToken,
            scopes: [...row.scopes],
            tokenType: row.tokenType
        };
    },
    async set(key, tokens) {
        await db
            .insert(etsyOAuthConnections)
            .values({
                accessToken: tokens.accessToken,
                clerkUserId: key.clerkUserId,
                expiresAt: tokens.expiresAt,
                refreshToken: tokens.refreshToken,
                scopes: tokens.scopes,
                tenantId: key.tenantId,
                tokenType: tokens.tokenType,
                updatedAt: new Date()
            })
            .onConflictDoUpdate({
                set: {
                    accessToken: tokens.accessToken,
                    expiresAt: tokens.expiresAt,
                    refreshToken: tokens.refreshToken,
                    scopes: tokens.scopes,
                    tokenType: tokens.tokenType,
                    updatedAt: new Date()
                },
                target: [etsyOAuthConnections.tenantId, etsyOAuthConnections.clerkUserId]
            });
    }
};
