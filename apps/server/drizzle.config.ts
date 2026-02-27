import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    dbCredentials: {
        database: process.env.DATABASE_NAME || 'etsysentry',
        host: process.env.DATABASE_HOST || 'localhost',
        password: process.env.DATABASE_PASSWORD || 'etsysentry_local_dev_password',
        port: Number(process.env.DATABASE_PORT) || 5435,
        user: process.env.DATABASE_USER || 'etsysentry',
    },
    dialect: 'postgresql',
    out: './drizzle',
    schema: './src/db/schema.ts',
});
