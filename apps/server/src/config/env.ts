import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(8080),
    APP_ORIGIN: z.string().url().default('http://localhost:5173'),
    ETSY_API_KEY: z.string().min(1),
    ETSY_API_SHARED_SECRET: z.string().min(1).optional(),
    ETSY_OAUTH_REDIRECT_URI: z.string().url(),
    ETSY_OAUTH_SCOPES: z.string().default('listings_r listings_w shops_r transactions_r'),
    ETSY_OAUTH_STATE_TTL_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
    ETSY_OAUTH_REFRESH_SKEW_MS: z.coerce.number().int().nonnegative().default(2 * 60 * 1000),
    DATABASE_HOST: z.string().min(1).optional(),
    DATABASE_PORT: z.coerce.number().int().positive().optional(),
    DATABASE_NAME: z.string().min(1).optional(),
    DATABASE_USER: z.string().min(1).optional(),
    DATABASE_PASSWORD: z.string().min(1).optional(),
    ETSYSENTRY_DATABASE_NAME: z.string().min(1).optional(),
    ETSYSENTRY_DATABASE_USER: z.string().min(1).optional(),
    ETSYSENTRY_DATABASE_PASSWORD: z.string().min(1).optional()
});

const rawEnv = envSchema.parse(process.env);

const REQUIRED_ETSY_OAUTH_SCOPES = ['listings_r'] as const;

const parseOAuthScopes = (rawScopes: string): string[] => {
    return rawScopes
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter((scope) => scope.length > 0);
};

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
    etsyOAuthScopes
};
