import { ServiceAccessError } from '@merchbaseco/access';
import { and, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { accessProjections } from '../db/schema';
import { getEtsySentryAccess } from '../services/access/etsysentry-access';
import { defineJob } from './job-router';

export const REFRESH_ACCESS_PROJECTIONS_JOB_NAME = 'refresh-access-projections';
export const REFRESH_ACCESS_PROJECTIONS_CRON = '15 3 * * *';

export const refreshAccessProjectionsJob = defineJob(REFRESH_ACCESS_PROJECTIONS_JOB_NAME, {
    startupSummary: 'daily repair of active access projections',
})
    .input(z.object({}))
    .options({
        retryLimit: 0,
        singletonKey: REFRESH_ACCESS_PROJECTIONS_JOB_NAME,
    })
    .cron({
        cron: REFRESH_ACCESS_PROJECTIONS_CRON,
        payload: {},
        scheduleOptions: {
            singletonKey: REFRESH_ACCESS_PROJECTIONS_JOB_NAME,
        },
    })
    .work(async (_job, _signal, log) => {
        const rows = await db
            .select({ merchbaseUserId: accessProjections.merchbaseUserId })
            .from(accessProjections)
            .where(
                and(
                    eq(accessProjections.state, 'active'),
                    isNotNull(accessProjections.merchbaseUserId)
                )
            );
        const merchbaseUserIds = Array.from(
            new Set(rows.flatMap((row) => (row.merchbaseUserId ? [row.merchbaseUserId] : [])))
        );
        let refreshedCount = 0;
        let skippedCount = 0;

        for (const merchbaseUserId of merchbaseUserIds) {
            try {
                await getEtsySentryAccess().sessionAccess.refreshAccess(merchbaseUserId);
                refreshedCount += 1;
            } catch (error) {
                skippedCount += 1;

                if (!(error instanceof ServiceAccessError)) {
                    log('Access projection refresh failed.', {
                        error,
                    });
                }
            }
        }

        log('Refreshed active access projections.', {
            candidateCount: merchbaseUserIds.length,
            refreshedCount,
            skippedCount,
        });

        return {
            candidateCount: merchbaseUserIds.length,
            refreshedCount,
            skippedCount,
        } as const;
    });
