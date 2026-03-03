export const derivedFavoritesPerDayWindowDays = 30;

export interface DerivedFavoritesPerDaySnapshot {
    favoritesDelta: number | null;
    observedAt: Date;
}

export interface DerivedFavoritesPerDayEstimate {
    coverageDays: number;
    value: number | null;
    windowDays: number;
}

const toUtcDayKey = (value: Date): string => {
    return value.toISOString().slice(0, 10);
};

const toPositiveFavoritesDelta = (value: number | null): number => {
    if (value === null || value <= 0) {
        return 0;
    }

    return value;
};

export const deriveShopFavoritesPerDay = (params: {
    snapshots: DerivedFavoritesPerDaySnapshot[];
}): DerivedFavoritesPerDayEstimate => {
    const observedDays = new Set<string>();
    let favorites = 0;
    let coverageDays = 0;

    for (const snapshot of params.snapshots) {
        const dayKey = toUtcDayKey(snapshot.observedAt);

        if (observedDays.has(dayKey)) {
            continue;
        }

        observedDays.add(dayKey);

        const favoritesDelta = toPositiveFavoritesDelta(snapshot.favoritesDelta);

        if (favoritesDelta > 0) {
            favorites += favoritesDelta;
            coverageDays += 1;
        }

        if (observedDays.size >= derivedFavoritesPerDayWindowDays) {
            break;
        }
    }

    if (coverageDays === 0) {
        return {
            coverageDays: 0,
            value: null,
            windowDays: derivedFavoritesPerDayWindowDays,
        };
    }

    return {
        coverageDays,
        value: Number((favorites / coverageDays).toFixed(2)),
        windowDays: derivedFavoritesPerDayWindowDays,
    };
};
