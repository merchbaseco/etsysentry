import { z } from 'zod';

// NODE_ENV is set by the runtime image, not by the schema: `VARLOCK_ENV` is a
// varlock builtin and is never delivered to a container, so NODE_ENV is the
// lifecycle signal available inside the process.
//
// Production must not boot without a webhook signing secret, but development
// has no Clerk webhook endpoint and therefore no secret to resolve — the schema
// leaves it undefined there.
const isProduction = process.env.NODE_ENV === 'production';

// Compose interpolates every delivered name, so a value the schema resolves as
// absent arrives as an empty string rather than as missing. Zod treats `''` as
// present, and `.optional()` does not save it — coerce it back to undefined.
const emptyAsUndefined = <Schema extends z.ZodTypeAny>(schema: Schema) =>
    z.preprocess((value) => (value === '' ? undefined : value), schema);

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    ETSYSENTRY_PORT: z.coerce.number().int().positive().default(8080),
    ETSYSENTRY_APP_ORIGIN: z.string().url().default('http://localhost:3100'),
    MERCHBASE_CLERK_SECRET_KEY: z.string().min(1),
    MERCHBASE_CLERK_ISSUER: z.string().url(),
    MERCHBASE_CLERK_JWT_KEY: z.string().min(1),
    MERCHBASE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    ETSYSENTRY_CLERK_AUTHORIZED_PARTIES: z.string().min(1),
    ETSYSENTRY_CLERK_WEBHOOK_SIGNING_SECRET: isProduction
        ? z.string().min(1)
        : emptyAsUndefined(z.string().min(1).optional()),
    ETSYSENTRY_ADMIN_MERCHBASE_USER_ID: emptyAsUndefined(
        z
            .string()
            .regex(/^mbu_[A-Za-z0-9_-]+$/)
            .optional()
    ),
    ETSYSENTRY_ETSY_API_KEY: z.string().min(1),
    ETSYSENTRY_ETSY_API_SHARED_SECRET: z.string().min(1),
    ETSYSENTRY_ETSY_OAUTH_REDIRECT_URI: z.string().url(),
    ETSYSENTRY_ETSY_OAUTH_SCOPES: z
        .string()
        .default('listings_r listings_w shops_r transactions_r'),
    ETSYSENTRY_ETSY_OAUTH_STATE_TTL_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(10 * 60 * 1000),
    ETSYSENTRY_ETSY_OAUTH_REFRESH_SKEW_MS: z.coerce
        .number()
        .int()
        .nonnegative()
        .default(2 * 60 * 1000),
    ETSYSENTRY_ETSY_RATE_LIMIT_DEFAULT_PER_SECOND: z.coerce.number().int().positive().default(150),
    ETSYSENTRY_ETSY_RATE_LIMIT_DEFAULT_PER_DAY: z.coerce.number().int().positive().default(100_000),
    ETSYSENTRY_ETSY_RATE_LIMIT_MAX_RETRIES: z.coerce.number().int().nonnegative().default(5),
    ETSYSENTRY_ETSY_RATE_LIMIT_BACKOFF_INITIAL_MS: z.coerce.number().int().positive().default(1000),
    ETSYSENTRY_ETSY_RATE_LIMIT_BACKOFF_MAX_MS: z.coerce.number().int().positive().default(60_000),
    ETSYSENTRY_ETSY_API_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    ETSYSENTRY_DATABASE_HOST: z.string().min(1).default('127.0.0.1'),
    ETSYSENTRY_DATABASE_PORT: z.coerce.number().int().positive().default(5435),
    ETSYSENTRY_DATABASE_NAME: z.string().min(1).default('etsysentry'),
    ETSYSENTRY_DATABASE_USER: z.string().min(1).default('etsysentry'),
    ETSYSENTRY_DATABASE_PASSWORD: z.string().min(1),
    ETSYSENTRY_DISABLE_SERVER_JOB_RUNNER: z.enum(['true', 'false']).optional(),
});

const rawEnv = envSchema.parse(process.env);

export const resolveDisableServerJobRunner = (value: 'true' | 'false' | undefined): boolean => {
    return value === 'true';
};

const REQUIRED_ETSY_OAUTH_SCOPES = ['listings_r'] as const;
const OAUTH_SCOPE_DELIMITER_REGEX = /[\s,]+/;
const AUTHORIZED_PARTY_DELIMITER_REGEX = /[\s,]+/;
const TRAILING_SLASHES_REGEX = /\/+$/;

const parseOAuthScopes = (rawScopes: string): string[] => {
    return rawScopes
        .split(OAUTH_SCOPE_DELIMITER_REGEX)
        .map((scope) => scope.trim())
        .filter((scope) => scope.length > 0);
};

const parseAuthorizedParties = (rawParties: string): string[] => {
    const parties = rawParties
        .split(AUTHORIZED_PARTY_DELIMITER_REGEX)
        .map((party) => party.trim().replace(TRAILING_SLASHES_REGEX, ''))
        .filter((party) => party.length > 0);

    if (parties.length === 0) {
        throw new Error('ETSYSENTRY_CLERK_AUTHORIZED_PARTIES must contain at least one party.');
    }

    return Array.from(new Set(parties));
};

const validateOAuthRedirectUri = (params: {
    nodeEnv: 'development' | 'test' | 'production';
    redirectUri: string;
}): void => {
    const parsedRedirectUri = new URL(params.redirectUri);

    if (parsedRedirectUri.pathname !== '/auth/etsy/callback') {
        throw new Error(
            `ETSYSENTRY_ETSY_OAUTH_REDIRECT_URI must use /auth/etsy/callback (received ${parsedRedirectUri.pathname}).`
        );
    }

    const isLoopbackHost = ['localhost', '127.0.0.1', '::1'].includes(parsedRedirectUri.hostname);

    if (params.nodeEnv === 'production' && isLoopbackHost) {
        throw new Error(
            'ETSYSENTRY_ETSY_OAUTH_REDIRECT_URI cannot use a localhost/loopback hostname in production.'
        );
    }
};

validateOAuthRedirectUri({
    nodeEnv: rawEnv.NODE_ENV,
    redirectUri: rawEnv.ETSYSENTRY_ETSY_OAUTH_REDIRECT_URI,
});

const etsyOAuthScopes = Array.from(
    new Set([
        ...parseOAuthScopes(rawEnv.ETSYSENTRY_ETSY_OAUTH_SCOPES),
        ...REQUIRED_ETSY_OAUTH_SCOPES,
    ])
);
const clerkAuthorizedParties = parseAuthorizedParties(rawEnv.ETSYSENTRY_CLERK_AUTHORIZED_PARTIES);

if (etsyOAuthScopes.length === 0) {
    throw new Error('ETSYSENTRY_ETSY_OAUTH_SCOPES must contain at least one OAuth scope.');
}

const disableServerJobRunner = resolveDisableServerJobRunner(
    rawEnv.ETSYSENTRY_DISABLE_SERVER_JOB_RUNNER
);

export const env = {
    ...rawEnv,
    databaseHost: rawEnv.ETSYSENTRY_DATABASE_HOST,
    databaseName: rawEnv.ETSYSENTRY_DATABASE_NAME,
    databasePassword: rawEnv.ETSYSENTRY_DATABASE_PASSWORD,
    databasePort: rawEnv.ETSYSENTRY_DATABASE_PORT,
    databaseUser: rawEnv.ETSYSENTRY_DATABASE_USER,
    disableServerJobRunner,
    enableServerJobs: !disableServerJobRunner,
    clerkAuthorizedParties,
    etsyOAuthScopes,
};
