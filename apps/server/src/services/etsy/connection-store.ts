import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { etsyOAuthConnections } from '../../db/schema';

export interface EtsyOAuthConnectionKey {
    accountId: string;
}

export interface EtsyOAuthTokens {
    accessToken: string;
    expiresAt: Date;
    refreshToken: string;
    scopes: string[];
    tokenType: string;
}

export interface EtsyOAuthConnectionStore {
    clear: (key: EtsyOAuthConnectionKey) => Promise<void>;
    get: (key: EtsyOAuthConnectionKey) => Promise<EtsyOAuthTokens | null>;
    set: (key: EtsyOAuthConnectionKey, tokens: EtsyOAuthTokens) => Promise<void>;
}

export class InMemoryEtsyOAuthConnectionStore implements EtsyOAuthConnectionStore {
    private readonly tokensByConnection = new Map<string, EtsyOAuthTokens>();

    clear(key: EtsyOAuthConnectionKey): Promise<void> {
        this.tokensByConnection.delete(this.toStorageKey(key));

        return Promise.resolve();
    }

    get(key: EtsyOAuthConnectionKey): Promise<EtsyOAuthTokens | null> {
        const tokens = this.tokensByConnection.get(this.toStorageKey(key));

        if (!tokens) {
            return Promise.resolve(null);
        }

        return Promise.resolve({
            ...tokens,
            expiresAt: new Date(tokens.expiresAt.getTime()),
            scopes: [...tokens.scopes],
        });
    }

    set(key: EtsyOAuthConnectionKey, tokens: EtsyOAuthTokens): Promise<void> {
        this.tokensByConnection.set(this.toStorageKey(key), {
            ...tokens,
            expiresAt: new Date(tokens.expiresAt.getTime()),
            scopes: [...tokens.scopes],
        });

        return Promise.resolve();
    }

    private toStorageKey(key: EtsyOAuthConnectionKey): string {
        return key.accountId;
    }
}

export const etsyOAuthConnectionStore: EtsyOAuthConnectionStore = {
    async clear(key) {
        await db
            .delete(etsyOAuthConnections)
            .where(eq(etsyOAuthConnections.accountId, key.accountId));
    },
    async get(key) {
        const [row] = await db
            .select()
            .from(etsyOAuthConnections)
            .where(eq(etsyOAuthConnections.accountId, key.accountId))
            .limit(1);

        if (!row) {
            return null;
        }

        return {
            accessToken: row.accessToken,
            expiresAt: row.expiresAt,
            refreshToken: row.refreshToken,
            scopes: [...row.scopes],
            tokenType: row.tokenType,
        };
    },
    async set(key, tokens) {
        await db.transaction(async (tx) => {
            await tx
                .delete(etsyOAuthConnections)
                .where(eq(etsyOAuthConnections.accountId, key.accountId));

            await tx.insert(etsyOAuthConnections).values({
                accessToken: tokens.accessToken,
                expiresAt: tokens.expiresAt,
                refreshToken: tokens.refreshToken,
                scopes: tokens.scopes,
                accountId: key.accountId,
                tokenType: tokens.tokenType,
                updatedAt: new Date(),
            });
        });
    },
};
