import { runMigrations } from './migrate';

await runMigrations();
console.log('[Migration] Completed successfully.');
