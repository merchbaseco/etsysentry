import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs under `varlock run`, so the schema is the only owner of
// these values; no local fallbacks are declared here.
export default defineConfig({
    dbCredentials: {
        database: process.env.ETSYSENTRY_DATABASE_NAME,
        host: process.env.ETSYSENTRY_DATABASE_HOST,
        password: process.env.ETSYSENTRY_DATABASE_PASSWORD,
        port: Number(process.env.ETSYSENTRY_DATABASE_PORT),
        user: process.env.ETSYSENTRY_DATABASE_USER,
    },
    dialect: 'postgresql',
    out: './drizzle',
    schema: './src/db/schema.ts',
});
