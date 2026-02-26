import { z } from 'zod';

const realtimeInvalidationQuerySchema = z.enum([
    'app.keywords.list',
    'app.listings.list',
    'app.shops.list',
    'app.logs.list'
]);

const realtimeSyncStateSchema = z.enum(['idle', 'queued', 'syncing']);
const realtimeSyncEntitySchema = z.enum(['listing', 'keyword', 'shop']);

const realtimeMessageSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('query.invalidate'),
        queries: z.array(realtimeInvalidationQuerySchema).min(1)
    }),
    z.object({
        type: z.literal('sync-state.push'),
        entity: realtimeSyncEntitySchema,
        ids: z.record(z.string().min(1), realtimeSyncStateSchema).refine(
            (ids) => Object.keys(ids).length > 0,
            {
                message: 'sync-state.push ids cannot be empty.'
            }
        )
    }),
    z.object({
        type: z.literal('dashboard-summary.push'),
        jobCounts: z.object({
            inFlightJobs: z.number().int().nonnegative(),
            queuedJobs: z.number().int().nonnegative()
        })
    })
]);

export type RealtimeMessage = z.infer<typeof realtimeMessageSchema>;
export type RealtimeInvalidationQuery = z.infer<typeof realtimeInvalidationQuerySchema>;
export type RealtimeSyncState = z.infer<typeof realtimeSyncStateSchema>;

export const parseRealtimeMessage = (rawData: unknown): RealtimeMessage | null => {
    if (typeof rawData !== 'string') {
        return null;
    }

    try {
        const parsedData = JSON.parse(rawData);
        const parsedMessage = realtimeMessageSchema.safeParse(parsedData);

        if (!parsedMessage.success) {
            return null;
        }

        return parsedMessage.data;
    } catch {
        return null;
    }
};

