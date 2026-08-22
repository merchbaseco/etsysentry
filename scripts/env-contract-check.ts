import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Name-only contract check across the four places an EtsySentry variable
// appears: `.env.schema` (the contract), the typed server surface in
// `apps/server/src/config/env.ts`, the Compose delivery for the server
// container, and the website build arguments — which must be declared BOTH in
// compose and as `ARG` in the Dockerfile, because Docker silently discards a
// build argument the Dockerfile never declares.
//
// This exists because nothing else can prove those four agree: `varlock audit`
// only sees direct `process.env` reads, and the server reads its values through
// a zod-parsed object. Nothing here resolves a value or contacts 1Password; it
// compares names and decorators only.

const repositoryRoot = process.cwd();
const schemaPath = join(repositoryRoot, '.env.schema');
const serverEnvPath = join(repositoryRoot, 'apps/server/src/config/env.ts');
const composePath = join(repositoryRoot, 'compose.yml');
const dockerfilePath = join(repositoryRoot, 'Dockerfile');

// Injected by varlock itself rather than delivered to any consumer.
const varlockBuiltins = new Set(['VARLOCK_ENV']);

// Set by the runtime image, not by the schema. NODE_ENV is the in-container
// lifecycle signal precisely because VARLOCK_ENV is never delivered.
const imageProvidedNames = new Set(['NODE_ENV']);

// The postgres image requires these literal names for first-boot
// initialisation. Compose delivers them to the database container; the server
// never reads them.
const postgresImageNames = new Set(['POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD']);

const itemPattern = /^([A-Z][A-Z0-9_]*)=/u;
const serverSchemaBlockPattern = /const envSchema = z\.object\(\{([\s\S]*?)\n\}\);/u;
const serverKeyPattern = /^\s{4}([A-Z][A-Z0-9_]*):/gmu;
const argPattern = /^ARG\s+([A-Z][A-Z0-9_]*)/gmu;
const firstNonSpacePattern = /\S/u;
const composeKeyPattern = /^\s*([A-Z][A-Z0-9_]*):/u;

interface SchemaItem {
    hasExplicitSensitivity: boolean;
    isInternal: boolean;
    isSensitive: boolean;
    name: string;
}

const readSchemaItems = (): SchemaItem[] => {
    const contents = readFileSync(schemaPath, 'utf8');
    const dividerIndex = contents.indexOf('\n# ---');
    const body = dividerIndex === -1 ? contents : contents.slice(dividerIndex + 6);

    const items: SchemaItem[] = [];
    let decorators: string[] = [];

    for (const line of body.split('\n')) {
        if (line.startsWith('#')) {
            decorators.push(line);
            continue;
        }

        const match = itemPattern.exec(line);
        if (match) {
            const attached = decorators.join(' ');
            items.push({
                name: match[1],
                isInternal: attached.includes('@internal'),
                isSensitive: attached.includes('@sensitive'),
                hasExplicitSensitivity:
                    attached.includes('@sensitive') || attached.includes('@public'),
            });
        }

        // A blank line (or the item itself) breaks decorator association.
        decorators = [];
    }

    return items;
};

const readServerNames = (): string[] => {
    const contents = readFileSync(serverEnvPath, 'utf8');
    const block = serverSchemaBlockPattern.exec(contents);

    if (!block) {
        console.error(`Could not find the \`envSchema\` object in ${serverEnvPath}.`);
        process.exit(1);
    }

    return [...block[1].matchAll(serverKeyPattern)].map((match) => match[1]);
};

// Line-based reader for the Compose blocks we care about. Compose is
// indentation-structured, so a block ends at the first line indented no deeper
// than its header. Every matching block is read, because `environment:` appears
// once per service.
const readComposeBlocks = (blockHeader: string, headerIndent: number): string[] => {
    const lines = readFileSync(composePath, 'utf8').split('\n');
    const names: string[] = [];
    let inside = false;

    const opensBlock = (line: string): boolean =>
        line.trimEnd().endsWith(blockHeader) && line.search(firstNonSpacePattern) === headerIndent;

    for (const line of lines) {
        if (!inside) {
            if (opensBlock(line)) {
                inside = true;
            }
            continue;
        }

        if (line.trim() === '' || line.trimStart().startsWith('#')) {
            continue;
        }

        if (line.search(firstNonSpacePattern) <= headerIndent) {
            inside = opensBlock(line);
            continue;
        }

        const match = composeKeyPattern.exec(line);
        if (match) {
            names.push(match[1]);
        }
    }

    return names;
};

const readDockerfileArgs = (): string[] => {
    const contents = readFileSync(dockerfilePath, 'utf8');
    return [...contents.matchAll(argPattern)].map((match) => match[1]);
};

const sorted = (names: Iterable<string>) => [...names].sort();

const schemaItems = readSchemaItems();
const deliverableNames = new Set(
    schemaItems
        .filter((item) => !(item.isInternal || varlockBuiltins.has(item.name)))
        .map((item) => item.name)
);

const serverNames = readServerNames();
const serverReadNames = new Set(serverNames.filter((name) => !imageProvidedNames.has(name)));

// The server's `environment:` sits at 4 spaces; the website image's build
// `args:` sit at 6.
const composeEnvironmentNames = new Set(readComposeBlocks('environment:', 4));
const composeBuildArgNames = new Set(readComposeBlocks('args:', 6));
const dockerfileArgNames = new Set(readDockerfileArgs());

const issues: string[] = [];

// 1. Sensitivity must be stated, not inherited. The schema defaults to
//    sensitive, so an unmarked item is safe but ambiguous to readers.
for (const item of schemaItems) {
    if (!item.hasExplicitSensitivity) {
        issues.push(`${item.name} does not declare @sensitive or @public in .env.schema.`);
    }
}

// 2. A VITE_ value is inlined into a public browser bundle at build time.
//    Marking one sensitive means a secret is about to ship to every visitor.
for (const item of schemaItems) {
    if (item.name.startsWith('VITE_') && item.isSensitive) {
        issues.push(
            `${item.name} is @sensitive but VITE_ values are inlined into the public website bundle.`
        );
    }
}

// 3. Duplicate keys in the typed server surface would silently shadow.
const seenServerNames = new Set<string>();
for (const name of serverNames) {
    if (seenServerNames.has(name)) {
        issues.push(`${name} is declared twice in ${serverEnvPath}.`);
    }
    seenServerNames.add(name);
}

// 4. Everything the server reads must be a deliverable schema item, and must
//    actually be delivered to the container.
for (const name of sorted(serverReadNames)) {
    if (!deliverableNames.has(name)) {
        issues.push(`${name} is read by the server but is not a deliverable .env.schema item.`);
    }

    if (!composeEnvironmentNames.has(name)) {
        issues.push(
            `${name} is read by the server but is not delivered in the compose \`environment:\` block.`
        );
    }
}

// 5. Compose must not deliver names the server does not read.
for (const name of sorted(composeEnvironmentNames)) {
    if (postgresImageNames.has(name)) {
        continue;
    }

    if (!serverReadNames.has(name)) {
        issues.push(
            `${name} is delivered by compose but is not read by the server in ${serverEnvPath}.`
        );
    }
}

// 6. Website build arguments must be declared on both sides.
for (const name of sorted(composeBuildArgNames)) {
    if (!dockerfileArgNames.has(name)) {
        issues.push(
            `${name} is passed as a compose build argument but is not declared as an ARG in Dockerfile (Docker would silently discard it).`
        );
    }

    if (!deliverableNames.has(name)) {
        issues.push(
            `${name} is passed as a compose build argument but is not a deliverable .env.schema item.`
        );
    }
}

for (const name of sorted(dockerfileArgNames)) {
    if (!composeBuildArgNames.has(name)) {
        issues.push(`${name} is declared as an ARG in Dockerfile but is never passed by compose.`);
    }
}

// 7. No orphans: every deliverable schema item must have a consumer.
for (const name of sorted(deliverableNames)) {
    if (!(serverReadNames.has(name) || composeBuildArgNames.has(name))) {
        issues.push(
            `${name} is a deliverable .env.schema item but nothing reads it (server surface or website build argument).`
        );
    }
}

if (issues.length > 0) {
    console.error('Environment contract is out of sync:');
    for (const issue of issues) {
        console.error(`- ${issue}`);
    }
    process.exit(1);
}

console.log(
    `Environment contract is in sync (${deliverableNames.size} deliverable schema variables, ${serverReadNames.size} read by the server, ${dockerfileArgNames.size} website build arguments).`
);
