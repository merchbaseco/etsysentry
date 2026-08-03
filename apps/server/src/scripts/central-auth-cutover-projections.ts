import { type AccessProjection, TERMINAL_PROJECTION_TIMESTAMP } from '@merchbaseco/access';
import type { Sql } from 'postgres';
import {
    accessValidUntilEpoch,
    type CutoverMapping,
    fingerprint,
} from './central-auth-cutover-lib';

interface CutoverProjectionSeed {
    eventId: string;
    identity: { issuer: string; subject: string };
    projection: AccessProjection | null;
    sourceUpdatedAt: number;
}

const applyProjection = async (
    database: Sql,
    params: {
        eventId: string;
        projection: AccessProjection | null;
        sourceUpdatedAt: number;
        identity: { issuer: string; subject: string };
    }
): Promise<void> => {
    const accepted = await database<{ eventId: string }[]>`
        INSERT INTO access_projection_event (
            event_id,
            issuer,
            subject,
            source_updated_at
        ) VALUES (
            ${params.eventId},
            ${params.identity.issuer},
            ${params.identity.subject},
            ${params.sourceUpdatedAt}
        )
        ON CONFLICT (event_id) DO NOTHING
        RETURNING event_id AS "eventId"
    `;

    if (!accepted[0]) {
        return;
    }

    await database`
        INSERT INTO access_projection (
            issuer,
            subject,
            state,
            merchbase_user_id,
            access,
            access_valid_until,
            source_updated_at,
            last_event_id
        ) VALUES (
            ${params.identity.issuer},
            ${params.identity.subject},
            ${params.projection ? 'active' : 'tombstone'},
            ${params.projection?.merchbaseUserId ?? null},
            ${params.projection?.access ?? null},
            ${params.projection?.accessValidUntil ?? null},
            ${params.sourceUpdatedAt},
            ${params.eventId}
        )
        ON CONFLICT (issuer, subject)
        DO UPDATE SET
            state = EXCLUDED.state,
            merchbase_user_id = EXCLUDED.merchbase_user_id,
            access = EXCLUDED.access,
            access_valid_until = EXCLUDED.access_valid_until,
            source_updated_at = EXCLUDED.source_updated_at,
            last_event_id = EXCLUDED.last_event_id,
            updated_at = now()
        WHERE access_projection.source_updated_at <= EXCLUDED.source_updated_at
    `;
};

export const seedCutoverProjections = async (
    database: Sql,
    mapping: CutoverMapping
): Promise<void> => {
    for (const seed of buildCutoverProjectionSeeds(mapping)) {
        await applyProjection(database, seed);
    }
};

export const buildCutoverProjectionSeeds = (mapping: CutoverMapping): CutoverProjectionSeed[] => {
    const retainedIdentity = {
        issuer: mapping.retained.issuer,
        subject: mapping.retained.subject,
    };
    const retainedProjection: AccessProjection = {
        issuer: retainedIdentity.issuer,
        subject: retainedIdentity.subject,
        merchbaseUserId: mapping.merchbaseUserId,
        access: mapping.retained.access,
        accessValidUntil: accessValidUntilEpoch(mapping.retained.accessValidUntil),
        sourceUpdatedAt: mapping.retained.sourceUpdatedAt,
    };
    const retainedSeed: CutoverProjectionSeed = {
        eventId: `cutover:${fingerprint(JSON.stringify(retainedProjection))}`,
        identity: retainedIdentity,
        projection: retainedProjection,
        sourceUpdatedAt: retainedProjection.sourceUpdatedAt,
    };

    return [
        retainedSeed,
        ...mapping.retiredIdentities.map((identity) => ({
            eventId: `cutover:${fingerprint(`${identity.issuer}:${identity.subject}:tombstone`)}`,
            identity,
            projection: null,
            sourceUpdatedAt: TERMINAL_PROJECTION_TIMESTAMP,
        })),
    ];
};
