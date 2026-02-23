import { z } from 'zod';
import { listEventLogs } from '../../../services/logs/list-event-logs';
import {
    eventLogLevelSchema,
    eventLogPrimitiveTypeSchema,
    eventLogStatusSchema
} from '../../../services/logs/event-log-types';
import { appProcedure } from '../../trpc';

const listLogsInputSchema = z.object({
    limit: z.number().int().min(1).max(100).default(20),
    cursor: z
        .object({
            occurredAt: z.string().datetime(),
            id: z.string().uuid()
        })
        .optional(),
    search: z.string().trim().min(1).optional(),
    levels: z.array(eventLogLevelSchema).optional(),
    statuses: z.array(eventLogStatusSchema).optional(),
    primitiveTypes: z.array(eventLogPrimitiveTypeSchema).optional(),
    actions: z.array(z.string().min(1)).optional(),
    listingId: z.string().min(1).optional(),
    shopId: z.string().min(1).optional(),
    keyword: z.string().min(1).optional(),
    monitorRunId: z.string().min(1).optional()
});

export const logsListProcedure = appProcedure
    .input(listLogsInputSchema)
    .query(async ({ ctx, input }) => {
        return listEventLogs({
            ...input,
            tenantId: ctx.tenantId
        });
    });
