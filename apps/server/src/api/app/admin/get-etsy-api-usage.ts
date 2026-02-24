import { z } from 'zod';
import { getEtsyApiUsage } from '../../../services/etsy/get-etsy-api-usage';
import { adminProcedure } from '../../trpc';

export const adminGetEtsyApiUsageProcedure = adminProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
        const usage = await getEtsyApiUsage({
            tenantId: ctx.tenantId
        });

        return {
            rateLimit: usage.rateLimit,
            stats: {
                callsPast5Minutes: usage.stats.callsPast5Minutes,
                callsPast24Hours: usage.stats.callsPast24Hours,
                callsPastHour: usage.stats.callsPastHour,
                lastCallAt: usage.stats.lastCallAt?.toISOString() ?? null
            }
        };
    });
