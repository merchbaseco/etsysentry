# EtsySentry Logging Strategy

## Purpose

Define one consistent logging strategy across server runtime, jobs, and services so logs are:

- structured and machine-filterable
- easy for humans to scan
- safe (no secrets/PII leakage)

This document complements `docs/log-view.md` (UI/UX requirements for viewing logs).

## Core Principles

1. Log structured payloads, not concatenated strings.
2. Include a stable `scope` for every log line.
3. Keep messages short and action-oriented.
4. Include enough context for debugging (`jobName`, IDs, status, counts).
5. Never log secrets, tokens, or raw sensitive payloads.

## Log Shape

Use this pattern:

- `message`: short sentence (what happened)
- `payload`: JSON object with context

Preferred payload fields:

- `scope`: logical module scope (for example: `jobs.router`, `jobs.sync-keyword`)
- IDs: `tenantId`, `trackedKeywordId`, `jobId`, `requestId` when available
- state fields: `status`, `didWork`, `queuedCount`, etc.
- errors: put error object under `error`

## Level Usage

- `info`: expected state changes and normal processing
- `warn`: recoverable problems, invalid input/payload, skipped work
- `error`: failed operations requiring investigation or retry

## Standardization Rules

1. Do not call `console.log`/`console.warn`/`console.error` directly in job definitions.
2. Prefer shared logger adapters that inject `scope`.
3. Build module-level loggers once and reuse them.
4. Keep logs deterministic and low-noise. Avoid per-item spam where batch summaries are enough.

## Jobs Logging (Current Pattern)

Jobs should use:

- `apps/server/src/jobs/jobs-logger.ts`
- `apps/server/src/jobs/job-runtime-utils.ts`

`createJobsLogger(...)` standardizes payload shape and scope wrapping.  
`createJobLog(...)` provides the `(message, context, level)` helper used in `defineJob(...).work(...)`.

## Service/API Logging Guidance

- Prefer a shared adapter pattern similar to jobs logging.
- Keep logger creation close to module boundaries (router/service runtime setup).
- Keep transport details (Fastify logger, console fallback) out of business logic.

## Safety Rules

Never log:

- OAuth access/refresh tokens
- API keys or secrets
- full raw third-party payloads containing sensitive fields

If a field might be sensitive, redact or omit it.

## Examples

```ts
logger.info(
    {
        scope: 'jobs.sync-keyword',
        trackedKeywordId,
        didWork: true
    },
    'Synced keyword ranks.'
);
```

```ts
logger.warn(
    {
        scope: 'jobs.router',
        jobName,
        jobId,
        error
    },
    'Skipping job with invalid payload.'
);
```

## Implementation Checklist

When adding new jobs/services:

1. Choose a stable `scope` name.
2. Reuse a shared logger adapter for that area.
3. Emit `info/warn/error` with structured context.
4. Validate no sensitive data is logged.
