import { assertLocalSeedTarget } from './local-database-guard';
import { DEFAULT_SEED_OPTIONS } from './plan';

/**
 * Fills a local database with one small synthetic account, so the dashboard,
 * the tRPC surface, and the CLI all have something to render. Never auto-runs
 * on a developer machine: local development points at the live database, and
 * the loopback guard is what keeps this away from it.
 *
 *   bun run db:seed:dev
 *   bun run db:seed:dev --seed=friday --days=14 --merchbase-user-id=mbu_...
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

const target = assertLocalSeedTarget({
    host: process.env.ETSYSENTRY_DATABASE_HOST ?? '127.0.0.1',
    name: process.env.ETSYSENTRY_DATABASE_NAME ?? 'etsysentry',
    nodeEnv: process.env.NODE_ENV,
    port: Number(process.env.ETSYSENTRY_DATABASE_PORT ?? 5435),
});

const { runSeed } = await import('./run-seed');

const summary = await runSeed({
    options: {
        accountId: args.get('--account-id') || DEFAULT_SEED_OPTIONS.accountId,
        dayCount: readInt('--days', DEFAULT_SEED_OPTIONS.dayCount),
        keywordCount: readInt('--keywords', DEFAULT_SEED_OPTIONS.keywordCount),
        listingCount: readInt('--listings', DEFAULT_SEED_OPTIONS.listingCount),
        merchbaseUserId: args.get('--merchbase-user-id') || DEFAULT_SEED_OPTIONS.merchbaseUserId,
        now: new Date(),
        seed: args.get('--seed') || DEFAULT_SEED_OPTIONS.seed,
    },
    target,
});

console.log(JSON.stringify(summary, null, 2));
