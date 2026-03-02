export const derivedSalesPerDayWindowDays = 30;

export interface DerivedSalesPerDaySnapshot {
    observedAt: Date;
    soldDelta: number | null;
}

export interface DerivedSalesPerDayEstimate {
    coverageDays: number;
    value: number | null;
    windowDays: number;
}

const toUtcDayKey = (value: Date): string => {
    return value.toISOString().slice(0, 10);
};

const toPositiveSoldDelta = (value: number | null): number => {
    if (value === null || value <= 0) {
        return 0;
    }

    return value;
};

export const deriveShopSalesPerDay = (params: {
    snapshots: DerivedSalesPerDaySnapshot[];
}): DerivedSalesPerDayEstimate => {
    const soldDeltaByDay = new Map<string, number>();

    for (const snapshot of params.snapshots) {
        const dayKey = toUtcDayKey(snapshot.observedAt);

        if (soldDeltaByDay.has(dayKey)) {
            continue;
        }

        soldDeltaByDay.set(dayKey, toPositiveSoldDelta(snapshot.soldDelta));

        if (soldDeltaByDay.size >= derivedSalesPerDayWindowDays) {
            break;
        }
    }

    const coverageDays = soldDeltaByDay.size;

    if (coverageDays === 0) {
        return {
            coverageDays: 0,
            value: null,
            windowDays: derivedSalesPerDayWindowDays,
        };
    }

    let soldUnits = 0;

    for (const value of soldDeltaByDay.values()) {
        soldUnits += value;
    }

    return {
        coverageDays,
        value: Number((soldUnits / coverageDays).toFixed(2)),
        windowDays: derivedSalesPerDayWindowDays,
    };
};
