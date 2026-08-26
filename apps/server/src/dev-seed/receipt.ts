import type { SeedRunSummary } from './run-seed';

/**
 * What a seed run leaves behind, in the form a person reads out of a boot log.
 *
 * A cloud session's whole starting state is decided here — which database was
 * filled, which signed-in user owns it, how much data there is, and how recent
 * it is — so the seed states all four rather than making the next reader open a
 * psql prompt to find out. Identifiers only: no credential, and no ticket.
 */

const LABEL_WIDTH = 16;

const line = (label: string, value: string): string =>
    `[seed] ${`${label}:`.padEnd(LABEL_WIDTH)}${value}`;

export const formatSeedReceipt = (summary: SeedRunSummary): string => {
    const rows = Object.entries(summary.rows)
        .filter(([, count]) => count > 0)
        .map(([table, count]) => `${table}=${count.toLocaleString('en-US')}`)
        .join(' ');

    return [
        line('Database', summary.target),
        line('Clerk issuer', summary.clerkIssuer),
        line('Signed-in user', `${summary.clerkSubject} -> ${summary.merchbaseUserId}`),
        line('Account', summary.accountId),
        line('Window', `${summary.dayCount} days through ${summary.through} (UTC)`),
        line('Dataset', `seed=${summary.seed}`),
        line('Rows', `${summary.totalRows.toLocaleString('en-US')} total`),
        line('Tables', rows),
        line('Finished', `${summary.durationMs.toLocaleString('en-US')}ms`),
    ].join('\n');
};

export const printSeedReceipt = (summary: SeedRunSummary): void => {
    console.log(formatSeedReceipt(summary));
};
