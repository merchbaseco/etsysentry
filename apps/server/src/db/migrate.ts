import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '../config/env';

export const runMigrations = async (): Promise<void> => {
    const migrationClient = postgres({
        database: env.databaseName,
        host: env.databaseHost,
        max: 1,
        password: env.databasePassword,
        port: env.databasePort,
        user: env.databaseUser,
    });

    try {
        const migrationDb = drizzle(migrationClient);

        await migrate(migrationDb, {
            migrationsFolder: './drizzle',
            migrationsTable: '__drizzle_migrations',
        });
    } finally {
        await migrationClient.end();
    }
};
