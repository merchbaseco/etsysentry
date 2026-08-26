import { assertLocalSeedTarget, SeedTargetRefusedError } from './local-database-guard';
import { DEFAULT_SEED_OPTIONS } from './plan';
import { printSeedReceipt } from './receipt';

/**
 * Fills a local database with one small synthetic account owned by the shared
 * Merchbase Dev Sign-In user, so the dashboard, the tRPC surface, and the CLI
 * all have something to render for whoever the dev auto sign-in signs in as.
 * Never auto-runs on a developer machine: local development points at the live
 * database, and the loopback guard is what keeps this away from it.
 *
 *   bun run db:seed:dev
 *   bun run db:seed:dev --seed=friday --days=14
 *
 * This file imports nothing that reads the parsed environment or opens a
 * connection. The guard has to be the first thing that runs, and a static
 * import of the database module would evaluate `config/env` ahead of it — so
 * the work lives behind the dynamic import below.
 */

const args = new Map(
    process.argv.slice(2).map((value) => {
        const [name, ...rest] = value.split('=');
        return [name, rest.join('=')] as const;
    })
);

const readInt = (name: string, fallback: number): number => {
    const raw = args.get(name);

    if (!raw) {
        return fallback;
    }

    const parsed = Number.parseInt(raw, 10);

    if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error(`${name} must be a positive integer.`);
    }

    return parsed;
};

/**
 * Both the loopback guard and the access bootstrap refuse with a complete,
 * actionable message. This output is read from a boot log, where a stack trace
 * would only bury it.
 */
const isRefusal = (error: unknown): error is Error =>
    error instanceof SeedTargetRefusedError ||
    (error instanceof Error && error.name === 'DevAccessBootstrapError');

try {
    const target = assertLocalSeedTarget({
        host: process.env.ETSYSENTRY_DATABASE_HOST ?? '127.0.0.1',
        name: process.env.ETSYSENTRY_DATABASE_NAME ?? 'etsysentry',
        nodeEnv: process.env.NODE_ENV,
        port: Number(process.env.ETSYSENTRY_DATABASE_PORT ?? 5435),
    });

    const { runSeed } = await import('./run-seed');

    printSeedReceipt(
        await runSeed({
            options: {
                accountId: args.get('--account-id') || DEFAULT_SEED_OPTIONS.accountId,
                dayCount: readInt('--days', DEFAULT_SEED_OPTIONS.dayCount),
                keywordCount: readInt('--keywords', DEFAULT_SEED_OPTIONS.keywordCount),
                listingCount: readInt('--listings', DEFAULT_SEED_OPTIONS.listingCount),
                merchbaseUserId: DEFAULT_SEED_OPTIONS.merchbaseUserId,
                now: new Date(),
                seed: args.get('--seed') || DEFAULT_SEED_OPTIONS.seed,
            },
            target,
        })
    );
} catch (error) {
    if (!isRefusal(error)) {
        throw error;
    }

    console.error(error.message);
    process.exit(1);
}
