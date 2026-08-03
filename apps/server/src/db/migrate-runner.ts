import { runMigrations } from './migrate';

const THROUGH_FLAG = '--through';
const scriptArguments = process.argv.slice(2);
const throughTag =
    scriptArguments.length === 2 && scriptArguments[0] === THROUGH_FLAG
        ? scriptArguments[1]
        : undefined;

if (scriptArguments.length !== 0 && !throughTag) {
    throw new Error(`Usage: migrate-runner.ts [${THROUGH_FLAG} <migration-tag>]`);
}

await runMigrations({ throughTag });
console.log('[Migration] Completed successfully.');
