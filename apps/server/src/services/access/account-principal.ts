import { ServiceAccessError } from '@merchbaseco/access';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { accounts } from '../../db/schema';

export interface EtsySentryAccountPrincipal {
    accountId: string;
}

export const resolveEtsySentryAccountPrincipal = async (params: {
    database?: typeof db;
    merchbaseUserId: string;
}): Promise<EtsySentryAccountPrincipal> => {
    if (!params.merchbaseUserId.startsWith('mbu_')) {
        throw new ServiceAccessError('access_unavailable');
    }

    const rows = await (params.database ?? db)
        .select({ accountId: accounts.id })
        .from(accounts)
        .where(eq(accounts.merchbaseUserId, params.merchbaseUserId))
        .limit(2);

    if (rows.length !== 1 || !rows[0]) {
        throw new ServiceAccessError('access_unavailable');
    }

    return rows[0];
};
