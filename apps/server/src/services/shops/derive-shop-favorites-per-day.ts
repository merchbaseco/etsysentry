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
    const favoritesDeltaByDay = new Map<string, number>();

    for (const snapshot of params.snapshots) {
        const dayKey = toUtcDayKey(snapshot.observedAt);

        if (favoritesDeltaByDay.has(dayKey)) {
            continue;
        }

        favoritesDeltaByDay.set(dayKey, toPositiveFavoritesDelta(snapshot.favoritesDelta));

        if (favoritesDeltaByDay.size >= derivedFavoritesPerDayWindowDays) {
            break;
        }
    }

    const coverageDays = favoritesDeltaByDay.size;

    if (coverageDays === 0) {
        return {
            coverageDays: 0,
            value: null,
            windowDays: derivedFavoritesPerDayWindowDays,
        };
    }

    let favorites = 0;

    for (const value of favoritesDeltaByDay.values()) {
        favorites += value;
    }

    return {
        coverageDays,
        value: Number((favorites / coverageDays).toFixed(2)),
        windowDays: derivedFavoritesPerDayWindowDays,
    };
};
