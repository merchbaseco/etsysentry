import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getListingMetricHistory } from '../../../services/listings/get-listing-metric-history';
import { publicProcedure } from '../../trpc';

const performanceMetricSchema = z.enum(['favorites', 'price', 'quantity', 'views']);

const relativeRangeDaysSchema = z.enum(['7d', '30d', '90d']);
const absoluteRangeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/);
const performanceRangeSchema = z.union([relativeRangeDaysSchema, absoluteRangeSchema]);

const parsePerformanceRange = (
    range: string | undefined
):
    | {
          days: number;
          label: string;
          fromObservedDate?: undefined;
          toObservedDate?: undefined;
      }
    | {
          days?: undefined;
          label: string;
          fromObservedDate: string;
          toObservedDate: string;
      } => {
    if (!range) {
        return {
            days: 30,
            label: '30d',
        };
    }

    const relative = relativeRangeDaysSchema.safeParse(range);

    if (relative.success) {
        return {
            days: Number.parseInt(relative.data.slice(0, -1), 10),
            label: relative.data,
        };
    }

    const absolute = absoluteRangeSchema.safeParse(range);

    if (!absolute.success) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Range must be 7d, 30d, 90d, or YYYY-MM-DD..YYYY-MM-DD.',
        });
    }

    const [fromObservedDate, toObservedDate] = absolute.data.split('..');

    return {
        fromObservedDate,
        toObservedDate,
        label: absolute.data,
    };
};

const toAscendingItems = <T extends { observedDate: string }>(items: T[]): T[] => {
    return [...items].sort((a, b) => a.observedDate.localeCompare(b.observedDate));
};

export const publicListingsGetPerformanceProcedure = publicProcedure
    .input(
        z.object({
            trackedListingId: z.string().uuid(),
            range: performanceRangeSchema.optional(),
            metrics: z.array(performanceMetricSchema).min(1).optional(),
        })
    )
    .query(async ({ ctx, input }) => {
        const parsedRange = parsePerformanceRange(input.range);
        const selectedMetrics = Array.from(
            new Set(input.metrics ?? ['views', 'favorites', 'quantity', 'price'])
        );

        const history = await getListingMetricHistory({
            accountId: ctx.accountId,
            trackedListingId: input.trackedListingId,
            days: parsedRange.days,
            fromObservedDate: parsedRange.fromObservedDate,
            toObservedDate: parsedRange.toObservedDate,
        });
        const sortedItems = toAscendingItems(history.items);
        const latest = sortedItems.at(-1) ?? null;

        const data: Record<string, unknown> = {
            listing: {
                id: history.listingId,
                etsyListingId: history.etsyListingId,
                title: history.title,
            },
            range: {
                label: parsedRange.label,
                from: history.fromObservedDate,
                to: history.toObservedDate,
            },
        };

        if (selectedMetrics.includes('views')) {
            data.views = {
                latest: latest?.views ?? null,
                points: sortedItems.map((item) => ({
                    ts: item.observedDate,
                    value: item.views,
                })),
            };
        }

        if (selectedMetrics.includes('favorites')) {
            data.favorites = {
                latest: latest?.favorerCount ?? null,
                points: sortedItems.map((item) => ({
                    ts: item.observedDate,
                    value: item.favorerCount,
                })),
            };
        }

        if (selectedMetrics.includes('quantity')) {
            data.quantity = {
                latest: latest?.quantity ?? null,
                points: sortedItems.map((item) => ({
                    ts: item.observedDate,
                    value: item.quantity,
                })),
            };
        }

        if (selectedMetrics.includes('price')) {
            data.price = {
                latest: latest?.price
                    ? {
                          value: latest.price.value,
                          currencyCode: latest.price.currencyCode,
                      }
                    : null,
                points: sortedItems.map((item) => ({
                    ts: item.observedDate,
                    value: item.price?.value ?? null,
                    currencyCode: item.price?.currencyCode ?? null,
                })),
            };
        }

        return data;
    });
