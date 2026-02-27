import { desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { clerkIdentities } from '../../db/schema';

export const findLatestClerkUserIdByAccountId = async (params: {
    accountId: string;
}): Promise<string | null> => {
    const [row] = await db
        .select({
            clerkUserId: clerkIdentities.clerkSubject,
        })
        .from(clerkIdentities)
        .where(eq(clerkIdentities.accountId, params.accountId))
        .orderBy(desc(clerkIdentities.lastSeenAt))
        .limit(1);

    return row?.clerkUserId ?? null;
};
