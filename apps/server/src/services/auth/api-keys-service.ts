import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { apiKeys } from '../../db/schema';

const API_KEY_VISIBLE_PREFIX = 'esk_live_';
const API_KEY_PREFIX_LENGTH = 20;
const API_KEY_RANDOM_HEX_BYTES = 24;
const HASH_SALT_BYTES = 16;
const HASH_BYTES = 32;
const HASH_VERSION = 's1';

interface ApiKeyHash {
    hash: Buffer;
    salt: Buffer;
    version: string;
}

export interface ApiKeyRecord {
    accountId: string;
    createdAt: string;
    id: string;
    keyPrefix: string;
    lastUsedAt: string | null;
    name: string;
    ownerClerkUserId: string;
    revokedAt: string | null;
    updatedAt: string;
}

export interface ApiKeyAuthRecord {
    accountId: string;
    id: string;
    keyPrefix: string;
    ownerClerkUserId: string;
}

const toRecord = (row: typeof apiKeys.$inferSelect): ApiKeyRecord => {
    return {
        id: row.id,
        accountId: row.accountId,
        ownerClerkUserId: row.ownerClerkUserId,
        name: row.name,
        keyPrefix: row.keyPrefix,
        lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
        revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
};

const getApiKeyPrefix = (rawApiKey: string): string => {
    return rawApiKey.slice(0, API_KEY_PREFIX_LENGTH);
};

const normalizeRawApiKey = (rawApiKey: string): string => {
    return rawApiKey.trim();
};

const isApiKeyFormat = (value: string): boolean => {
    return value.startsWith(API_KEY_VISIBLE_PREFIX) && value.length > API_KEY_PREFIX_LENGTH;
};

const serializeApiKeyHash = (hash: ApiKeyHash): string => {
    return [hash.version, hash.salt.toString('hex'), hash.hash.toString('hex')].join(':');
};

const parseApiKeyHash = (serialized: string): ApiKeyHash | null => {
    const [version, saltHex, hashHex] = serialized.split(':');

    if (!(version && saltHex && hashHex)) {
        return null;
    }

    try {
        return {
            version,
            salt: Buffer.from(saltHex, 'hex'),
            hash: Buffer.from(hashHex, 'hex'),
        };
    } catch {
        return null;
    }
};

const hashRawApiKey = (rawApiKey: string): string => {
    const salt = randomBytes(HASH_SALT_BYTES);
    const hash = scryptSync(rawApiKey, salt, HASH_BYTES);

    return serializeApiKeyHash({
        version: HASH_VERSION,
        salt,
        hash,
    });
};

const verifyRawApiKey = (params: { rawApiKey: string; serializedHash: string }): boolean => {
    const parsed = parseApiKeyHash(params.serializedHash);

    if (!parsed || parsed.version !== HASH_VERSION) {
        return false;
    }

    const computed = scryptSync(params.rawApiKey, parsed.salt, parsed.hash.length);

    if (computed.length !== parsed.hash.length) {
        return false;
    }

    return timingSafeEqual(computed, parsed.hash);
};

const generateRawApiKey = (): string => {
    const randomHex = randomBytes(API_KEY_RANDOM_HEX_BYTES).toString('hex');
    return `${API_KEY_VISIBLE_PREFIX}${randomHex}`;
};

export const listApiKeysByAccountId = async (params: {
    accountId: string;
}): Promise<{ items: ApiKeyRecord[] }> => {
    const rows = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.accountId, params.accountId))
        .orderBy(desc(apiKeys.createdAt));

    return {
        items: rows.map(toRecord),
    };
};

export const createApiKey = async (params: {
    accountId: string;
    ownerClerkUserId: string;
    name: string;
}): Promise<{
    item: ApiKeyRecord;
    rawApiKey: string;
}> => {
    const now = new Date();
    const rawApiKey = generateRawApiKey();

    const [row] = await db
        .insert(apiKeys)
        .values({
            accountId: params.accountId,
            ownerClerkUserId: params.ownerClerkUserId,
            name: params.name,
            keyPrefix: getApiKeyPrefix(rawApiKey),
            keyHash: hashRawApiKey(rawApiKey),
            createdAt: now,
            updatedAt: now,
        })
        .returning();

    return {
        item: toRecord(row),
        rawApiKey,
    };
};

export const revokeApiKeyById = async (params: {
    accountId: string;
    apiKeyId: string;
}): Promise<ApiKeyRecord | null> => {
    const now = new Date();

    const [row] = await db
        .update(apiKeys)
        .set({
            revokedAt: now,
            updatedAt: now,
        })
        .where(
            and(
                eq(apiKeys.accountId, params.accountId),
                eq(apiKeys.id, params.apiKeyId),
                isNull(apiKeys.revokedAt)
            )
        )
        .returning();

    return row ? toRecord(row) : null;
};

export const authenticateApiKey = async (params: {
    rawApiKey: string;
}): Promise<ApiKeyAuthRecord | null> => {
    const rawApiKey = normalizeRawApiKey(params.rawApiKey);

    if (!isApiKeyFormat(rawApiKey)) {
        return null;
    }

    const rows = await db
        .select({
            id: apiKeys.id,
            accountId: apiKeys.accountId,
            ownerClerkUserId: apiKeys.ownerClerkUserId,
            keyPrefix: apiKeys.keyPrefix,
            keyHash: apiKeys.keyHash,
        })
        .from(apiKeys)
        .where(and(eq(apiKeys.keyPrefix, getApiKeyPrefix(rawApiKey)), isNull(apiKeys.revokedAt)));

    for (const row of rows) {
        if (
            verifyRawApiKey({
                rawApiKey,
                serializedHash: row.keyHash,
            })
        ) {
            await db
                .update(apiKeys)
                .set({
                    lastUsedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(apiKeys.id, row.id));

            return {
                id: row.id,
                accountId: row.accountId,
                ownerClerkUserId: row.ownerClerkUserId,
                keyPrefix: row.keyPrefix,
            };
        }
    }

    return null;
};

export const isPotentialApiKeyToken = (token: string | null): boolean => {
    return token ? normalizeRawApiKey(token).startsWith(API_KEY_VISIBLE_PREFIX) : false;
};
