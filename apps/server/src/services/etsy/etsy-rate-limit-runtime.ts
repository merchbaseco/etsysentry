import { env } from '../../config/env';

type EtsyRateLimitState = {
    blockedUntilMs: number;
    perDayLimit: number;
    perSecondLimit: number;
    requestsInCurrentSecond: number;
    secondWindowStartMs: number;
};

export type EtsyFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type EtsyRateLimitDependencies = {
    now: () => number;
    sleep: (delayMs: number) => Promise<void>;
};

export type EtsyRateLimitRuntimeSnapshot = {
    blockedForMs: number;
    blockedUntil: string | null;
    perDayLimit: number;
    perSecondLimit: number;
    requestsInCurrentSecond: number;
    secondWindowResetsInMs: number;
    secondWindowStartedAt: string | null;
};

const createInitialRateLimitState = (): EtsyRateLimitState => {
    return {
        blockedUntilMs: 0,
        perDayLimit: Math.max(1, env.ETSY_RATE_LIMIT_DEFAULT_PER_DAY),
        perSecondLimit: Math.max(1, env.ETSY_RATE_LIMIT_DEFAULT_PER_SECOND),
        requestsInCurrentSecond: 0,
        secondWindowStartMs: -1
    };
};

let rateLimitState = createInitialRateLimitState();
let stateLock: Promise<void> = Promise.resolve();

const withStateLock = async <T>(work: () => Promise<T> | T): Promise<T> => {
    const next = stateLock.then(() => work());
    stateLock = next.then(
        () => undefined,
        () => undefined
    );

    return next;
};

const parsePositiveInteger = (value: string | null): number | null => {
    if (!value) {
        return null;
    }

    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return parsed;
};

const parseNonNegativeInteger = (value: string | null): number | null => {
    if (!value) {
        return null;
    }

    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed < 0) {
        return null;
    }

    return parsed;
};

const parseHeaderInteger = (
    headers: Headers,
    names: string[],
    parser: (value: string | null) => number | null
): number | null => {
    for (const name of names) {
        const parsed = parser(headers.get(name));

        if (parsed !== null) {
            return parsed;
        }
    }

    return null;
};

const getMsUntilNextUtcDay = (nowMs: number): number => {
    const current = new Date(nowMs);
    const nextUtcMidnight = Date.UTC(
        current.getUTCFullYear(),
        current.getUTCMonth(),
        current.getUTCDate() + 1,
        0,
        0,
        0,
        0
    );

    return Math.max(1_000, nextUtcMidnight - nowMs);
};

const refreshSecondWindow = (nowMs: number): void => {
    if (
        rateLimitState.secondWindowStartMs < 0 ||
        nowMs - rateLimitState.secondWindowStartMs >= 1_000
    ) {
        rateLimitState.secondWindowStartMs = nowMs;
        rateLimitState.requestsInCurrentSecond = 0;
    }
};

export const parseRetryAfterMs = (headers: Headers, nowMs: number): number | null => {
    const retryAfterRaw = headers.get('retry-after');

    if (!retryAfterRaw) {
        return null;
    }

    const parsedSeconds = Number.parseFloat(retryAfterRaw);

    if (Number.isFinite(parsedSeconds) && parsedSeconds >= 0) {
        return Math.ceil(parsedSeconds * 1000);
    }

    const parsedTimestamp = Date.parse(retryAfterRaw);

    if (!Number.isFinite(parsedTimestamp)) {
        return null;
    }

    return Math.max(0, parsedTimestamp - nowMs);
};

export const setEtsyRateLimitCooldown = async (params: {
    delayMs: number;
    nowMs: number;
}): Promise<void> => {
    if (params.delayMs <= 0) {
        return;
    }

    await withStateLock(() => {
        rateLimitState.blockedUntilMs = Math.max(
            rateLimitState.blockedUntilMs,
            params.nowMs + params.delayMs
        );
    });
};

export const observeEtsyRateLimitHeaders = async (params: {
    headers: Headers;
    nowMs: number;
}): Promise<void> => {
    const perSecondLimit = parseHeaderInteger(
        params.headers,
        ['x-limit-per-second'],
        parsePositiveInteger
    );
    const perDayLimit = parseHeaderInteger(
        params.headers,
        ['x-limit-per-day'],
        parsePositiveInteger
    );
    const remainingThisSecond = parseHeaderInteger(
        params.headers,
        ['x-remaining-this-second', 'x-remaining-this-secon'],
        parseNonNegativeInteger
    );
    const remainingToday = parseHeaderInteger(
        params.headers,
        ['x-remaining-today'],
        parseNonNegativeInteger
    );
    const retryAfterMs = parseRetryAfterMs(params.headers, params.nowMs);

    await withStateLock(() => {
        if (perSecondLimit !== null) {
            rateLimitState.perSecondLimit = perSecondLimit;
        }

        if (perDayLimit !== null) {
            rateLimitState.perDayLimit = perDayLimit;
        }

        refreshSecondWindow(params.nowMs);

        if (remainingThisSecond !== null) {
            if (remainingThisSecond <= 0) {
                rateLimitState.blockedUntilMs = Math.max(
                    rateLimitState.blockedUntilMs,
                    params.nowMs + 1_000
                );
            } else {
                const inferredUsedCount = Math.max(
                    0,
                    rateLimitState.perSecondLimit - remainingThisSecond
                );

                rateLimitState.requestsInCurrentSecond = Math.max(
                    rateLimitState.requestsInCurrentSecond,
                    inferredUsedCount
                );
            }
        }

        if (remainingToday !== null && remainingToday <= 0) {
            rateLimitState.blockedUntilMs = Math.max(
                rateLimitState.blockedUntilMs,
                params.nowMs + getMsUntilNextUtcDay(params.nowMs)
            );
        }

        if (retryAfterMs !== null && retryAfterMs > 0) {
            rateLimitState.blockedUntilMs = Math.max(
                rateLimitState.blockedUntilMs,
                params.nowMs + retryAfterMs
            );
        }
    });
};

export const reserveEtsyRequestPermit = async (
    deps: EtsyRateLimitDependencies
): Promise<void> => {
    while (true) {
        const waitMs = await withStateLock(() => {
            const nowMs = deps.now();

            if (nowMs < rateLimitState.blockedUntilMs) {
                return Math.max(1, rateLimitState.blockedUntilMs - nowMs);
            }

            refreshSecondWindow(nowMs);

            const limit = Math.max(1, rateLimitState.perSecondLimit);

            if (rateLimitState.requestsInCurrentSecond < limit) {
                rateLimitState.requestsInCurrentSecond += 1;
                return 0;
            }

            return Math.max(1, rateLimitState.secondWindowStartMs + 1_000 - nowMs);
        });

        if (waitMs <= 0) {
            return;
        }

        await deps.sleep(waitMs);
    }
};

export const getEtsyRateLimitRuntimeSnapshot = async (
    params?: {
        nowMs?: number;
    }
): Promise<EtsyRateLimitRuntimeSnapshot> => {
    return withStateLock(() => {
        const nowMs = params?.nowMs ?? Date.now();
        refreshSecondWindow(nowMs);

        const blockedForMs = Math.max(0, rateLimitState.blockedUntilMs - nowMs);
        const secondWindowResetsInMs = Math.max(
            0,
            rateLimitState.secondWindowStartMs < 0
                ? 0
                : rateLimitState.secondWindowStartMs + 1_000 - nowMs
        );

        return {
            blockedForMs,
            blockedUntil:
                blockedForMs > 0
                    ? new Date(rateLimitState.blockedUntilMs).toISOString()
                    : null,
            perDayLimit: rateLimitState.perDayLimit,
            perSecondLimit: rateLimitState.perSecondLimit,
            requestsInCurrentSecond: rateLimitState.requestsInCurrentSecond,
            secondWindowResetsInMs,
            secondWindowStartedAt:
                rateLimitState.secondWindowStartMs < 0
                    ? null
                    : new Date(rateLimitState.secondWindowStartMs).toISOString()
        };
    });
};

export const resetEtsyRateLimitStateForTests = (): void => {
    rateLimitState = createInitialRateLimitState();
    stateLock = Promise.resolve();
};
