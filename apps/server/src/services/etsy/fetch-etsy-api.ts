import { env } from '../../config/env';
import {
    type EtsyFetch,
    type EtsyRateLimitDependencies,
    observeEtsyRateLimitHeaders,
    parseRetryAfterMs,
    reserveEtsyRequestPermit,
    resetEtsyRateLimitStateForTests as resetEtsyRateLimitRuntimeStateForTests,
    setEtsyRateLimitCooldown,
} from './etsy-rate-limit-runtime';

type FetchEtsyApiDependencies = EtsyRateLimitDependencies & {
    fetchImpl: EtsyFetch;
    requestTimeoutMs: number;
};

const getDefaultFetchEtsyApiDependencies = (): FetchEtsyApiDependencies => {
    return {
        fetchImpl: globalThis.fetch,
        now: () => Date.now(),
        sleep: async (delayMs: number) => {
            if (delayMs <= 0) {
                return;
            }

            await new Promise((resolve) => setTimeout(resolve, delayMs));
        },
        requestTimeoutMs: env.ETSY_API_REQUEST_TIMEOUT_MS,
    };
};

const isAbortError = (error: unknown): boolean => {
    if (!(error instanceof Error)) {
        return false;
    }

    return error.name === 'AbortError';
};

class EtsyFetchTimeoutError extends Error {
    readonly timeoutMs: number;

    constructor(timeoutMs: number) {
        super(`Etsy request timed out after ${timeoutMs}ms.`);
        this.name = 'EtsyFetchTimeoutError';
        this.timeoutMs = timeoutMs;
    }
}

const fetchEtsyApiWithTimeout = async (params: {
    fetchImpl: EtsyFetch;
    init: RequestInit;
    timeoutMs: number;
    url: string;
}): Promise<Response> => {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => {
        timeoutController.abort();
    }, params.timeoutMs);

    const upstreamSignal = params.init.signal;
    let removeUpstreamAbortListener: (() => void) | null = null;

    if (upstreamSignal) {
        if (upstreamSignal.aborted) {
            timeoutController.abort();
        } else {
            const onUpstreamAbort = () => {
                timeoutController.abort();
            };

            upstreamSignal.addEventListener('abort', onUpstreamAbort, { once: true });
            removeUpstreamAbortListener = () => {
                upstreamSignal.removeEventListener('abort', onUpstreamAbort);
            };
        }
    }

    try {
        return await params.fetchImpl(params.url, {
            ...params.init,
            signal: timeoutController.signal,
        });
    } catch (error) {
        if (!(timeoutController.signal.aborted && isAbortError(error))) {
            throw error;
        }

        if (upstreamSignal?.aborted) {
            throw error;
        }

        throw new EtsyFetchTimeoutError(params.timeoutMs);
    } finally {
        clearTimeout(timeout);
        removeUpstreamAbortListener?.();
    }
};

const shouldRetryRateLimitedResponse = (response: Response): boolean => {
    if (response.status === 429) {
        return true;
    }

    if (response.status !== 503) {
        return false;
    }

    return response.headers.has('retry-after');
};

const getExponentialBackoffMs = (attempt: number): number => {
    const multiplier = 2 ** Math.max(0, attempt);
    const delay = env.ETSY_RATE_LIMIT_BACKOFF_INITIAL_MS * multiplier;
    return Math.min(env.ETSY_RATE_LIMIT_BACKOFF_MAX_MS, delay);
};

export const fetchEtsyApi = async (
    params: {
        init: RequestInit;
        url: string;
    },
    dependencies?: Partial<FetchEtsyApiDependencies>
): Promise<Response> => {
    const deps: FetchEtsyApiDependencies = {
        ...getDefaultFetchEtsyApiDependencies(),
        ...dependencies,
    };

    for (let attempt = 0; ; attempt += 1) {
        await reserveEtsyRequestPermit(deps);

        let response: Response;

        try {
            response = await fetchEtsyApiWithTimeout({
                fetchImpl: deps.fetchImpl,
                init: params.init,
                timeoutMs: deps.requestTimeoutMs,
                url: params.url,
            });
        } catch (error) {
            if (
                !(error instanceof EtsyFetchTimeoutError) ||
                attempt >= env.ETSY_RATE_LIMIT_MAX_RETRIES
            ) {
                throw error;
            }

            const nowMs = deps.now();
            const delayMs = getExponentialBackoffMs(attempt);

            await setEtsyRateLimitCooldown({
                delayMs,
                nowMs,
            });
            await deps.sleep(delayMs);

            continue;
        }

        const nowMs = deps.now();

        await observeEtsyRateLimitHeaders({
            headers: response.headers,
            nowMs,
        });

        if (!shouldRetryRateLimitedResponse(response)) {
            return response;
        }

        if (attempt >= env.ETSY_RATE_LIMIT_MAX_RETRIES) {
            return response;
        }

        const retryAfterMs = parseRetryAfterMs(response.headers, nowMs);
        const delayMs = retryAfterMs ?? getExponentialBackoffMs(attempt);

        await setEtsyRateLimitCooldown({
            delayMs,
            nowMs,
        });

        await deps.sleep(delayMs);
    }
};

export const resetEtsyRateLimitStateForTests = (): void => {
    resetEtsyRateLimitRuntimeStateForTests();
};
