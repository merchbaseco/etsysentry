import { and, desc, eq, ilike, inArray, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { eventLogs } from '../../db/schema';
import { type EventLogRecord } from './create-event-log';
import {
    eventLogLevelSchema,
    eventLogPrimitiveTypeSchema,
    eventLogStatusSchema
} from './event-log-types';

const listEventLogsInputSchema = z
    .object({
        tenantId: z.string().min(1),
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
    })
    .strict();

export type ListEventLogsInput = z.input<typeof listEventLogsInputSchema>;

export type EventLogsCursor = {
    id: string;
    occurredAt: string;
};

export type ListEventLogsResult = {
    items: EventLogRecord[];
    nextCursor: EventLogsCursor | null;
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

export const listEventLogs = async (input: ListEventLogsInput): Promise<ListEventLogsResult> => {
    const parsed = listEventLogsInputSchema.parse(input);
    const conditions = [eq(eventLogs.tenantId, parsed.tenantId)];

    if (parsed.levels && parsed.levels.length > 0) {
        conditions.push(inArray(eventLogs.level, parsed.levels));
    }

    if (parsed.statuses && parsed.statuses.length > 0) {
        conditions.push(inArray(eventLogs.status, parsed.statuses));
    }

    if (parsed.primitiveTypes && parsed.primitiveTypes.length > 0) {
        conditions.push(inArray(eventLogs.primitiveType, parsed.primitiveTypes));
    }

    if (parsed.actions && parsed.actions.length > 0) {
        conditions.push(inArray(eventLogs.action, parsed.actions));
    }

    if (parsed.listingId) {
        conditions.push(eq(eventLogs.listingId, parsed.listingId));
    }

    if (parsed.shopId) {
        conditions.push(eq(eventLogs.shopId, parsed.shopId));
    }

    if (parsed.keyword) {
        conditions.push(eq(eventLogs.keyword, parsed.keyword));
    }

    if (parsed.monitorRunId) {
        conditions.push(eq(eventLogs.monitorRunId, parsed.monitorRunId));
    }

    if (parsed.search) {
        const partialMatch = `%${parsed.search}%`;

        conditions.push(
            or(
                ilike(eventLogs.message, partialMatch),
                ilike(eventLogs.action, partialMatch),
                ilike(eventLogs.keyword, partialMatch),
                eq(eventLogs.listingId, parsed.search),
                eq(eventLogs.shopId, parsed.search),
                eq(eventLogs.monitorRunId, parsed.search),
                eq(eventLogs.requestId, parsed.search)
            ) as NonNullable<ReturnType<typeof or>>
        );
    }

    if (parsed.cursor) {
        const cursorOccurredAt = new Date(parsed.cursor.occurredAt);

        conditions.push(
            or(
                lt(eventLogs.occurredAt, cursorOccurredAt),
                and(
                    eq(eventLogs.occurredAt, cursorOccurredAt),
                    lt(eventLogs.id, parsed.cursor.id)
                )
            ) as NonNullable<ReturnType<typeof or>>
        );
    }

    const rows = await db
        .select()
        .from(eventLogs)
        .where(and(...conditions))
        .orderBy(desc(eventLogs.occurredAt), desc(eventLogs.id))
        .limit(parsed.limit + 1);

    const hasMore = rows.length > parsed.limit;
    const pageRows = hasMore ? rows.slice(0, parsed.limit) : rows;
    const items = pageRows.map(toRecord);
    const tail = pageRows[pageRows.length - 1];

    return {
        items,
        nextCursor: hasMore && tail
            ? {
                  id: tail.id,
                  occurredAt: tail.occurredAt.toISOString()
              }
            : null
    };
};
