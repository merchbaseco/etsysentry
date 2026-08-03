import type {
    AccessProjection,
    AccessProjectionEvent,
    AccessProjectionStore,
    ClerkIdentity,
} from '@merchbaseco/access';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { accessProjectionEvents, accessProjections } from '../../db/schema';

type ProjectionRow = typeof accessProjections.$inferSelect;

export const createAccessProjectionStore = (database: typeof db = db): AccessProjectionStore => ({
    apply: (event) => applyProjectionEvent(database, event),
    findByIdentity: (identity) => findByIdentity(database, identity),
    findByMerchbaseUserId: (merchbaseUserId) => findByMerchbaseUserId(database, merchbaseUserId),
});

const applyProjectionEvent = async (
    database: typeof db,
    event: AccessProjectionEvent
): Promise<void> => {
    const identity = event.type === 'upsert' ? event.projection : event.identity;
    const sourceUpdatedAt =
        event.type === 'upsert' ? event.projection.sourceUpdatedAt : event.sourceUpdatedAt;

    await database.transaction(async (transaction) => {
        const accepted = await transaction
            .insert(accessProjectionEvents)
            .values({
                eventId: event.eventId,
                issuer: identity.issuer,
                subject: identity.subject,
                sourceUpdatedAt,
            })
            .onConflictDoNothing({ target: accessProjectionEvents.eventId })
            .returning({ eventId: accessProjectionEvents.eventId });

        if (accepted.length === 0) {
            return;
        }

        const projection = event.type === 'upsert' ? event.projection : null;

        await transaction
            .insert(accessProjections)
            .values({
                issuer: identity.issuer,
                subject: identity.subject,
                state: projection ? 'active' : 'tombstone',
                merchbaseUserId: projection?.merchbaseUserId ?? null,
                access: projection?.access ?? null,
                accessValidUntil: projection?.accessValidUntil ?? null,
                sourceUpdatedAt,
                lastEventId: event.eventId,
            })
            .onConflictDoUpdate({
                target: [accessProjections.issuer, accessProjections.subject],
                set: {
                    state: projection ? 'active' : 'tombstone',
                    merchbaseUserId: projection?.merchbaseUserId ?? null,
                    access: projection?.access ?? null,
                    accessValidUntil: projection?.accessValidUntil ?? null,
                    sourceUpdatedAt,
                    lastEventId: event.eventId,
                    updatedAt: new Date(),
                },
                where: sql`${accessProjections.sourceUpdatedAt} <= ${sourceUpdatedAt}`,
            });
    });
};

const findByIdentity = async (
    database: typeof db,
    identity: ClerkIdentity
): Promise<Awaited<ReturnType<AccessProjectionStore['findByIdentity']>>> => {
    const [row] = await database
        .select()
        .from(accessProjections)
        .where(
            and(
                eq(accessProjections.issuer, identity.issuer),
                eq(accessProjections.subject, identity.subject)
            )
        )
        .limit(1);

    if (!row) {
        return { type: 'missing' };
    }

    if (row.state === 'tombstone') {
        return { type: 'tombstone' };
    }

    return {
        type: 'active',
        projection: toProjection(row),
    };
};

const findByMerchbaseUserId = async (
    database: typeof db,
    merchbaseUserId: string
): Promise<AccessProjection | null> => {
    const [row] = await database
        .select()
        .from(accessProjections)
        .where(
            and(
                eq(accessProjections.state, 'active'),
                eq(accessProjections.merchbaseUserId, merchbaseUserId)
            )
        )
        .orderBy(
            desc(accessProjections.sourceUpdatedAt),
            asc(accessProjections.issuer),
            asc(accessProjections.subject)
        )
        .limit(1);

    return row ? toProjection(row) : null;
};

const toProjection = (row: ProjectionRow): AccessProjection => {
    if (!(row.merchbaseUserId && row.access)) {
        throw new Error('Active access projection is missing required values.');
    }

    return {
        issuer: row.issuer,
        subject: row.subject,
        merchbaseUserId: row.merchbaseUserId,
        access: row.access,
        accessValidUntil: toNullableSafeInteger(row.accessValidUntil, 'access_valid_until'),
        sourceUpdatedAt: toSafeInteger(row.sourceUpdatedAt, 'source_updated_at'),
    };
};

const toNullableSafeInteger = (value: number | null, field: string): number | null => {
    return value === null ? null : toSafeInteger(value, field);
};

const toSafeInteger = (value: number, field: string): number => {
    if (!Number.isSafeInteger(value)) {
        throw new Error(`Invalid ${field} in access projection.`);
    }

    return value;
};
