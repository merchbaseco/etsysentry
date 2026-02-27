export interface EtsyRateLimitState {
    blockedUntilMs: number;
    headersObservedAtMs: number | null;
    perDayLimit: number;
    perSecondLimit: number;
    remainingThisSecond: number | null;
    remainingToday: number | null;
    requestsInCurrentSecond: number;
    secondWindowStartMs: number;
}

export interface EtsyRateLimitRuntimeSnapshot {
    blockedForMs: number;
    blockedUntil: string | null;
    headersObservedAt: string | null;
    perDayLimit: number;
    perSecondLimit: number;
    remainingThisSecond: number | null;
    remainingToday: number | null;
    requestsInCurrentSecond: number;
    secondWindowResetsInMs: number;
    secondWindowStartedAt: string | null;
}

export const createInitialRateLimitState = (params: {
    defaultPerDayLimit: number;
    defaultPerSecondLimit: number;
}): EtsyRateLimitState => {
    return {
        blockedUntilMs: 0,
        headersObservedAtMs: null,
        perDayLimit: params.defaultPerDayLimit,
        perSecondLimit: params.defaultPerSecondLimit,
        remainingThisSecond: null,
        remainingToday: null,
        requestsInCurrentSecond: 0,
        secondWindowStartMs: -1,
    };
};
