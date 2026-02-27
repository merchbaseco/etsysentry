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
    };
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

        const response = await deps.fetchImpl(params.url, params.init);
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
