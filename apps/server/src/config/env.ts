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
    ETSY_OAUTH_REFRESH_SKEW_MS: z.coerce.number().int().nonnegative().default(2 * 60 * 1000)
});

const rawEnv = envSchema.parse(process.env);

const etsyOAuthScopes = rawEnv.ETSY_OAUTH_SCOPES.split(/\s+/).filter((scope) => scope.length > 0);

if (etsyOAuthScopes.length === 0) {
    throw new Error('ETSY_OAUTH_SCOPES must contain at least one OAuth scope.');
}

export const env = {
    ...rawEnv,
    etsyOAuthScopes
};
