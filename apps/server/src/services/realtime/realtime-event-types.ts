import { z } from 'zod';

export const realtimeInvalidationQuerySchema = z.enum([
    'app.keywords.list',
    'app.listings.list',
    'app.shops.list',
    'app.logs.list'
]);

export type RealtimeInvalidationQuery = z.infer<typeof realtimeInvalidationQuerySchema>;

export const realtimeSyncStateSchema = z.enum(['idle', 'queued', 'syncing']);

export type RealtimeSyncState = z.infer<typeof realtimeSyncStateSchema>;

export const realtimeSyncEntitySchema = z.enum(['listing', 'keyword', 'shop']);

export type RealtimeSyncEntity = z.infer<typeof realtimeSyncEntitySchema>;

const syncStatePushEventSchema = z.object({
    type: z.literal('sync-state.push'),
    accountId: z.string().min(1),
    entity: realtimeSyncEntitySchema,
    ids: z.record(z.string().min(1), realtimeSyncStateSchema).refine(
        (ids) => Object.keys(ids).length > 0,
        {
            message: 'sync-state.push ids cannot be empty.'
        }
    )
});

const dashboardSummaryPushEventSchema = z.object({
    type: z.literal('dashboard-summary.push'),
    accountId: z.string().min(1),
    jobCounts: z.object({
        inFlightJobs: z.number().int().nonnegative(),
        queuedJobs: z.number().int().nonnegative()
    })
});

const queryInvalidationEventSchema = z.object({
    type: z.literal('query.invalidate'),
    accountId: z.string().min(1),
    queries: z.array(realtimeInvalidationQuerySchema).min(1)
});

export const realtimeEventSchema = z.discriminatedUnion('type', [
    syncStatePushEventSchema,
    dashboardSummaryPushEventSchema,
    queryInvalidationEventSchema
]);

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

