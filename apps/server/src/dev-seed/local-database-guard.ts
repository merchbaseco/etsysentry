/**
 * The dev seed writes fabricated listings, ranks, shop snapshots, and event
 * logs. "Not production" is not a safe test for where it may run: the schema's
 * development arm points `ETSYSENTRY_DATABASE_HOST` at the Mac mini over
 * Tailscale, and that host serves the live database (see `docs/deployment.md`).
 * The only structurally safe target is a PostgreSQL on this machine, so the
 * guard accepts loopback and refuses everything else — including every hostname
 * that could resolve off-box. There is no override flag.
 */

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);
const IPV6_BRACKETS = /^\[|\]$/gu;

export interface SeedDatabaseTarget {
    host: string;
    name: string;
    port: number;
}

export interface SeedTargetInput {
    host: string;
    name: string;
    nodeEnv?: string;
    port: number;
}

export class SeedTargetRefusedError extends Error {
    constructor(reason: string, target: SeedDatabaseTarget) {
        super(
            [
                'Refusing to seed: the dev seed only runs against a local database.',
                `Reason: ${reason}`,
                `Target: ${describeTarget(target)}`,
                'ETSYSENTRY_DATABASE_HOST must be 127.0.0.1, ::1, or localhost.',
                'Local development resolves to the live EtsySentry database over Tailscale,',
                'which this seed must never touch.',
                'Point the run at a PostgreSQL on this machine, for example:',
                'ETSYSENTRY_DATABASE_HOST=127.0.0.1 bun run db:seed:dev',
            ].join('\n')
        );
        this.name = 'SeedTargetRefusedError';
    }
}

/** Host, port, and database name only — never a credential. */
export const describeTarget = (target: SeedDatabaseTarget): string =>
    `${target.host}:${target.port}/${target.name}`;

export const assertLocalSeedTarget = (input: SeedTargetInput): SeedDatabaseTarget => {
    const target: SeedDatabaseTarget = {
        host: input.host.trim().replace(IPV6_BRACKETS, '').toLowerCase(),
        name: input.name,
        port: input.port,
    };

    if (input.nodeEnv === 'production') {
        throw new SeedTargetRefusedError('NODE_ENV is production', target);
    }

    if (!LOOPBACK_HOSTS.has(target.host)) {
        throw new SeedTargetRefusedError(`database host ${target.host} is not loopback`, target);
    }

    return target;
};
