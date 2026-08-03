import { ServiceAccessError } from '@merchbaseco/access';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { accounts } from '../../db/schema';
import { type EtsySentryAccess, getEtsySentryAccess } from './etsysentry-access';

export type AccountAccessResult =
    | {
          merchbaseUserId: string;
          state: 'allowed';
      }
    | {
          merchbaseUserId: string | null;
          state: 'denied' | 'unavailable';
      };

export const evaluateAccountAccess = async (params: {
    accountId: string;
    access?: EtsySentryAccess;
    database?: typeof db;
}): Promise<AccountAccessResult> => {
    const database = params.database ?? db;
    let merchbaseUserId: string | null = null;

    try {
        const [account] = await database
            .select({ merchbaseUserId: accounts.merchbaseUserId })
            .from(accounts)
            .where(eq(accounts.id, params.accountId))
            .limit(2);
        merchbaseUserId = account?.merchbaseUserId ?? null;

        if (!(account && merchbaseUserId)) {
            return {
                merchbaseUserId,
                state: 'unavailable',
            };
        }

        await (params.access ?? getEtsySentryAccess()).sessionAccess.evaluateAccess(
            merchbaseUserId
        );

        return {
            merchbaseUserId,
            state: 'allowed',
        };
    } catch (error) {
        return {
            merchbaseUserId,
            state:
                error instanceof ServiceAccessError && error.code === 'access_denied'
                    ? 'denied'
                    : 'unavailable',
        };
    }
};
