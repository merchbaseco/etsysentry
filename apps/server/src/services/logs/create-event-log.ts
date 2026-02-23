import { z } from 'zod';
import { db } from '../../db';
import { eventLogs } from '../../db/schema';
import { emitEvent } from '../realtime/emit-event';
import {
    eventLogDetailsSchema,
    eventLogLevelSchema,
    eventLogPrimitiveTypeSchema,
    eventLogStatusSchema
} from './event-log-types';

const createEventLogInputSchema = z
    .object({
        clerkUserId: z.string().min(1).nullable().optional().default(null),
        tenantId: z.string().min(1),
        occurredAt: z.date().optional(),
        level: eventLogLevelSchema.default('info'),
        category: z.string().min(1).default('monitor'),
        action: z.string().min(1),
        status: eventLogStatusSchema.default('success'),
        primitiveType: eventLogPrimitiveTypeSchema,
        primitiveId: z.string().min(1).nullable().optional().default(null),
        listingId: z.string().min(1).nullable().optional().default(null),
        shopId: z.string().min(1).nullable().optional().default(null),
        keyword: z.string().min(1).nullable().optional().default(null),
        message: z.string().min(1),
        detailsJson: eventLogDetailsSchema.optional().default({}),
        monitorRunId: z.string().min(1).nullable().optional().default(null),
        requestId: z.string().min(1).nullable().optional().default(null)
    })
    .strict();

type CreateEventLogInput = z.input<typeof createEventLogInputSchema>;

export type EventLogRecord = {
    id: string;
    tenantId: string;
    occurredAt: string;
    level: z.infer<typeof eventLogLevelSchema>;
    category: string;
    action: string;
    status: z.infer<typeof eventLogStatusSchema>;
    primitiveType: z.infer<typeof eventLogPrimitiveTypeSchema>;
    primitiveId: string | null;
    listingId: string | null;
    shopId: string | null;
    keyword: string | null;
    message: string;
    detailsJson: Record<string, unknown>;
    monitorRunId: string | null;
    requestId: string | null;
};

const toDetailsJson = (value: unknown): Record<string, unknown> => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    return {};
};

const toRecord = (row: typeof eventLogs.$inferSelect): EventLogRecord => {
    return {
        id: row.id,
        tenantId: row.tenantId,
        occurredAt: row.occurredAt.toISOString(),
        level: row.level,
        category: row.category,
        action: row.action,
        status: row.status,
        primitiveType: row.primitiveType,
        primitiveId: row.primitiveId,
        listingId: row.listingId,
        shopId: row.shopId,
        keyword: row.keyword,
        message: row.message,
        detailsJson: toDetailsJson(row.detailsJson),
        monitorRunId: row.monitorRunId,
        requestId: row.requestId
    };
};

const toInsertValues = (input: CreateEventLogInput) => {
    const parsed = createEventLogInputSchema.parse(input);

    return {
        clerkUserId: parsed.clerkUserId,
        values: {
            tenantId: parsed.tenantId,
            occurredAt: parsed.occurredAt ?? new Date(),
            level: parsed.level,
            category: parsed.category,
            action: parsed.action,
            status: parsed.status,
            primitiveType: parsed.primitiveType,
            primitiveId: parsed.primitiveId,
            listingId: parsed.listingId,
            shopId: parsed.shopId,
            keyword: parsed.keyword,
            message: parsed.message,
            detailsJson: parsed.detailsJson,
            monitorRunId: parsed.monitorRunId,
            requestId: parsed.requestId
        }
    };
};

export const createEventLog = async (input: CreateEventLogInput): Promise<EventLogRecord> => {
    const parsed = toInsertValues(input);
    const [row] = await db.insert(eventLogs).values(parsed.values).returning();

    if (parsed.clerkUserId) {
        emitEvent({
            clerkUserId: parsed.clerkUserId,
            queries: ['app.logs.list'],
            tenantId: parsed.values.tenantId
        });
    }

    return toRecord(row);
};

export const createEventLogs = async (input: CreateEventLogInput[]): Promise<EventLogRecord[]> => {
    if (input.length === 0) {
        return [];
    }

    const parsedValues = input.map((item) => toInsertValues(item));
    const rows = await db
        .insert(eventLogs)
        .values(parsedValues.map((value) => value.values))
        .returning();

    const invalidationTargets = new Set<string>();

    for (const value of parsedValues) {
        if (!value.clerkUserId) {
            continue;
        }

        invalidationTargets.add(JSON.stringify([value.values.tenantId, value.clerkUserId]));
    }

    for (const target of invalidationTargets) {
        const [tenantId, clerkUserId] = JSON.parse(target) as [string, string];

        emitEvent({
            clerkUserId,
            queries: ['app.logs.list'],
            tenantId
        });
    }

    return rows.map(toRecord);
};
