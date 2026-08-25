/**
 * Every window the seed builds is anchored to the run's `now`, so the dataset
 * always describes the current week no matter when it is run. Days are UTC
 * because that is the day boundary `listing_metric_snapshots.observed_date` and
 * the shop metric history use.
 */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const MS_PER_HOUR = 60 * 60 * 1000;
export const MS_PER_MINUTE = 60 * 1000;

export const startOfUtcDay = (value: Date): Date =>
    new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

export const shiftMs = (value: Date, milliseconds: number): Date =>
    new Date(value.getTime() + milliseconds);

export const shiftDays = (value: Date, days: number): Date => shiftMs(value, days * MS_PER_DAY);

export const toUtcDayLabel = (value: Date): string => value.toISOString().slice(0, 10);

/**
 * The seed's day window: `dayCount` UTC days ending on the day of `now`, oldest
 * first. Callers index it directly, so the last entry is always today.
 */
export const buildDayWindow = (params: { dayCount: number; now: Date }): Date[] => {
    const today = startOfUtcDay(params.now);

    return Array.from({ length: params.dayCount }, (_unused, index) =>
        shiftDays(today, index - (params.dayCount - 1))
    );
};

/** True when the day falls on a Saturday or Sunday, which run busier. */
export const isWeekend = (day: Date): boolean => {
    const weekday = day.getUTCDay();
    return weekday === 0 || weekday === 6;
};
