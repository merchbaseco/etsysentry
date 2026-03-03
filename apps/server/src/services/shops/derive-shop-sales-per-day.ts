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
    const observedDays = new Set<string>();
    let soldUnits = 0;
    let coverageDays = 0;

    for (const snapshot of params.snapshots) {
        const dayKey = toUtcDayKey(snapshot.observedAt);

        if (observedDays.has(dayKey)) {
            continue;
        }

        observedDays.add(dayKey);

        const soldDelta = toPositiveSoldDelta(snapshot.soldDelta);

        if (soldDelta > 0) {
            soldUnits += soldDelta;
            coverageDays += 1;
        }

        if (observedDays.size >= derivedSalesPerDayWindowDays) {
            break;
        }
    }

    if (coverageDays === 0) {
        return {
            coverageDays: 0,
            value: null,
            windowDays: derivedSalesPerDayWindowDays,
        };
    }

    return {
        coverageDays,
        value: Number((soldUnits / coverageDays).toFixed(2)),
        windowDays: derivedSalesPerDayWindowDays,
    };
};
