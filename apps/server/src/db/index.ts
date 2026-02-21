import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env';
import * as schema from './schema';

const queryClient = postgres({
    database: env.databaseName,
    host: env.databaseHost,
    idle_timeout: 10,
    max: 5,
    max_lifetime: 30,
    password: env.databasePassword,
    port: env.databasePort,
    user: env.databaseUser
});

export const db = drizzle(queryClient, {
    logger: env.NODE_ENV === 'development',
    schema
});

export const closeDbConnection = async (): Promise<void> => {
    await queryClient.end();
};

export const testDbConnection = async (): Promise<void> => {
    await db.execute('SELECT 1');
};
