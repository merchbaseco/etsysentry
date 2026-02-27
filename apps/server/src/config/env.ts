import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(8080),
    APP_ORIGIN: z.string().url().default('http://localhost:5173'),
    CLERK_SECRET_KEY: z.string().min(1),
    ADMIN_EMAIL: z.string().email(),
    ETSY_API_KEY: z.string().min(1),
    ETSY_API_SHARED_SECRET: z.string().min(1),
    ETSY_OAUTH_REDIRECT_URI: z.string().url(),
    ETSY_OAUTH_SCOPES: z.string().default('listings_r listings_w shops_r transactions_r'),
    ETSY_OAUTH_STATE_TTL_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(10 * 60 * 1000),
    ETSY_OAUTH_REFRESH_SKEW_MS: z.coerce
        .number()
        .int()
        .nonnegative()
        .default(2 * 60 * 1000),
    ETSY_RATE_LIMIT_DEFAULT_PER_SECOND: z.coerce.number().int().positive().default(150),
    ETSY_RATE_LIMIT_DEFAULT_PER_DAY: z.coerce.number().int().positive().default(100_000),
    ETSY_RATE_LIMIT_MAX_RETRIES: z.coerce.number().int().nonnegative().default(5),
    ETSY_RATE_LIMIT_BACKOFF_INITIAL_MS: z.coerce.number().int().positive().default(1000),
    ETSY_RATE_LIMIT_BACKOFF_MAX_MS: z.coerce.number().int().positive().default(60_000),
    ETSY_API_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    DATABASE_HOST: z.string().min(1).optional(),
    DATABASE_PORT: z.coerce.number().int().positive().optional(),
    DATABASE_NAME: z.string().min(1).optional(),
    DATABASE_USER: z.string().min(1).optional(),
    DATABASE_PASSWORD: z.string().min(1).optional(),
    ETSYSENTRY_DATABASE_NAME: z.string().min(1).optional(),
    ETSYSENTRY_DATABASE_USER: z.string().min(1).optional(),
    ETSYSENTRY_DATABASE_PASSWORD: z.string().min(1).optional(),
});

const rawEnv = envSchema.parse(process.env);

const REQUIRED_ETSY_OAUTH_SCOPES = ['listings_r'] as const;
const OAUTH_SCOPE_DELIMITER_REGEX = /[\s,]+/;

const parseOAuthScopes = (rawScopes: string): string[] => {
    return rawScopes
        .split(OAUTH_SCOPE_DELIMITER_REGEX)
        .map((scope) => scope.trim())
        .filter((scope) => scope.length > 0);
};

const validateOAuthRedirectUri = (params: {
    nodeEnv: 'development' | 'test' | 'production';
    redirectUri: string;
}): void => {
    const parsedRedirectUri = new URL(params.redirectUri);

    if (parsedRedirectUri.pathname !== '/auth/etsy/callback') {
        throw new Error(
            `ETSY_OAUTH_REDIRECT_URI must use /auth/etsy/callback (received ${parsedRedirectUri.pathname}).`
        );
    }

    const isLoopbackHost = ['localhost', '127.0.0.1', '::1'].includes(parsedRedirectUri.hostname);

    if (params.nodeEnv === 'production' && isLoopbackHost) {
        throw new Error(
            'ETSY_OAUTH_REDIRECT_URI cannot use a localhost/loopback hostname in production.'
        );
    }
};

validateOAuthRedirectUri({
    nodeEnv: rawEnv.NODE_ENV,
    redirectUri: rawEnv.ETSY_OAUTH_REDIRECT_URI,
});

const etsyOAuthScopes = Array.from(
    new Set([...parseOAuthScopes(rawEnv.ETSY_OAUTH_SCOPES), ...REQUIRED_ETSY_OAUTH_SCOPES])
);

if (etsyOAuthScopes.length === 0) {
    throw new Error('ETSY_OAUTH_SCOPES must contain at least one OAuth scope.');
}

export const env = {
    ...rawEnv,
    databaseHost: rawEnv.DATABASE_HOST ?? 'localhost',
    databaseName: rawEnv.DATABASE_NAME ?? rawEnv.ETSYSENTRY_DATABASE_NAME ?? 'etsysentry',
    databasePassword:
        rawEnv.DATABASE_PASSWORD ??
        rawEnv.ETSYSENTRY_DATABASE_PASSWORD ??
        'etsysentry_local_dev_password',
    databasePort: rawEnv.DATABASE_PORT ?? 5435,
    databaseUser: rawEnv.DATABASE_USER ?? rawEnv.ETSYSENTRY_DATABASE_USER ?? 'etsysentry',
    etsyOAuthScopes,
};
