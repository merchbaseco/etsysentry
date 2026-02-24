import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '../../db';
import { accounts, clerkIdentities } from '../../db/schema';

export type ResolveAccountIdFromClerkInput = {
    clerkIssuer: string;
    clerkOrgId: string | null;
    clerkSubject: string;
    email: string | null;
};

type ResolvePreferredAccountIdInput = {
    accountIdFromIdentity: string | null;
    accountIdFromEmail: string | null;
};

const normalizeEmail = (email: string | null): string | null => {
    if (!email) {
        return null;
    }

    const normalized = email.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
};

const findExistingByIdentity = async (params: {
    clerkIssuer: string;
    clerkSubject: string;
}): Promise<string | null> => {
    const [existing] = await db
        .select({ accountId: clerkIdentities.accountId })
        .from(clerkIdentities)
        .where(
            and(
                eq(clerkIdentities.clerkIssuer, params.clerkIssuer),
                eq(clerkIdentities.clerkSubject, params.clerkSubject)
            )
        )
        .limit(1);

    return existing ? existing.accountId : null;
};

const findExistingByEmail = async (normalizedEmail: string): Promise<string | null> => {
    const [existing] = await db
        .select({ accountId: clerkIdentities.accountId })
        .from(clerkIdentities)
        .where(eq(clerkIdentities.email, normalizedEmail))
        .orderBy(desc(clerkIdentities.lastSeenAt))
        .limit(1);

    return existing ? existing.accountId : null;
};

const upsertIdentity = async (params: {
    accountId: string;
    clerkIssuer: string;
    clerkOrgId: string | null;
    clerkSubject: string;
    email: string | null;
}): Promise<void> => {
    const now = new Date();

    await db
        .insert(clerkIdentities)
        .values({
            accountId: params.accountId,
            clerkIssuer: params.clerkIssuer,
            clerkOrgId: params.clerkOrgId,
            clerkSubject: params.clerkSubject,
            createdAt: now,
            email: params.email,
            lastSeenAt: now,
            updatedAt: now
        })
        .onConflictDoUpdate({
            set: {
                clerkOrgId: params.clerkOrgId,
                email: params.email,
                lastSeenAt: now,
                updatedAt: now
            },
            target: [clerkIdentities.clerkIssuer, clerkIdentities.clerkSubject]
        });
};

export const resolvePreferredAccountId = (input: ResolvePreferredAccountIdInput): string | null => {
    return input.accountIdFromEmail ?? input.accountIdFromIdentity;
};

export const resolveAccountIdFromClerk = async (
    input: ResolveAccountIdFromClerkInput
): Promise<string> => {
    const normalizedEmail = normalizeEmail(input.email);
    const accountIdFromIdentity = await findExistingByIdentity({
        clerkIssuer: input.clerkIssuer,
        clerkSubject: input.clerkSubject
    });
    const accountIdFromEmail = normalizedEmail ? await findExistingByEmail(normalizedEmail) : null;
    const linkedAccountId = resolvePreferredAccountId({
        accountIdFromEmail,
        accountIdFromIdentity
    });
    const accountId = linkedAccountId ?? randomUUID();

    if (!linkedAccountId) {
        const now = new Date();

        await db.insert(accounts).values({
            createdAt: now,
            id: accountId,
            updatedAt: now
        });
    }

    await upsertIdentity({
        accountId,
        clerkIssuer: input.clerkIssuer,
        clerkOrgId: input.clerkOrgId,
        clerkSubject: input.clerkSubject,
        email: normalizedEmail
    });

    return accountId;
};
