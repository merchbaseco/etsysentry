import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { env } from '../../config/env';
import { fetchEtsyApi, resetEtsyRateLimitStateForTests } from './fetch-etsy-api';

describe('fetch-etsy-api', () => {
    beforeEach(() => {
        resetEtsyRateLimitStateForTests();
    });

    afterEach(() => {
        resetEtsyRateLimitStateForTests();
    });

    test('retries on 429 using retry-after header delay', async () => {
        let nowMs = 10_000;
        const sleepCalls: number[] = [];
        let requestCount = 0;

        const response = await fetchEtsyApi(
            {
                init: {
                    method: 'GET',
                },
                url: 'https://example.com',
            },
            {
                fetchImpl: async () => {
                    await Promise.resolve();
                    requestCount += 1;

                    if (requestCount === 1) {
                        return new Response('rate limited', {
                            headers: {
                                'retry-after': '2',
                            },
                            status: 429,
                        });
                    }

                    return new Response('ok', {
                        status: 200,
                    });
                },
                now: () => nowMs,
                sleep: async (delayMs) => {
                    await Promise.resolve();
                    sleepCalls.push(delayMs);
                    nowMs += delayMs;
                },
            }
        );

        expect(response.status).toBe(200);
        expect(requestCount).toBe(2);
        expect(sleepCalls).toEqual([2000]);
    });

    test('uses exponential backoff when retry-after header is missing', async () => {
        let nowMs = 10_000;
        const sleepCalls: number[] = [];
        let requestCount = 0;

        const response = await fetchEtsyApi(
            {
                init: {
                    method: 'GET',
                },
                url: 'https://example.com',
            },
            {
                fetchImpl: async () => {
                    await Promise.resolve();
                    requestCount += 1;

                    if (requestCount < 3) {
                        return new Response('rate limited', {
                            status: 429,
                        });
                    }

                    return new Response('ok', {
                        status: 200,
                    });
                },
                now: () => nowMs,
                sleep: async (delayMs) => {
                    await Promise.resolve();
                    sleepCalls.push(delayMs);
                    nowMs += delayMs;
                },
            }
        );

        expect(response.status).toBe(200);
        expect(requestCount).toBe(3);
        expect(sleepCalls).toEqual([1000, 2000]);
    });

    test('waits for the next second window when response reports no remaining second quota', async () => {
        let nowMs = 10_000;
        const sleepCalls: number[] = [];
        const requestTimes: number[] = [];

        const fetchImpl = async () => {
            await Promise.resolve();
            requestTimes.push(nowMs);

            return new Response('ok', {
                headers: {
                    'x-limit-per-second': '2',
                    'x-remaining-this-secon': '0',
                },
                status: 200,
            });
        };

        await fetchEtsyApi(
            {
                init: {
                    method: 'GET',
                },
                url: 'https://example.com/first',
            },
            {
                fetchImpl,
                now: () => nowMs,
                sleep: async (delayMs) => {
                    await Promise.resolve();
                    sleepCalls.push(delayMs);
                    nowMs += delayMs;
                },
            }
        );

        await fetchEtsyApi(
            {
                init: {
                    method: 'GET',
                },
                url: 'https://example.com/second',
            },
            {
                fetchImpl,
                now: () => nowMs,
                sleep: async (delayMs) => {
                    await Promise.resolve();
                    sleepCalls.push(delayMs);
                    nowMs += delayMs;
                },
            }
        );

        expect(requestTimes).toEqual([10_000, 11_000]);
        expect(sleepCalls).toEqual([1000]);
    });

    test('stops retrying after configured max retries', async () => {
        let nowMs = 10_000;
        const sleepCalls: number[] = [];
        let requestCount = 0;

        const response = await fetchEtsyApi(
            {
                init: {
                    method: 'GET',
                },
                url: 'https://example.com',
            },
            {
                fetchImpl: async () => {
                    await Promise.resolve();
                    requestCount += 1;

                    return new Response('rate limited', {
                        status: 429,
                    });
                },
                now: () => nowMs,
                sleep: async (delayMs) => {
                    await Promise.resolve();
                    sleepCalls.push(delayMs);
                    nowMs += delayMs;
                },
            }
        );

        expect(response.status).toBe(429);
        expect(requestCount).toBe(env.ETSY_RATE_LIMIT_MAX_RETRIES + 1);
        expect(sleepCalls.length).toBe(env.ETSY_RATE_LIMIT_MAX_RETRIES);
    });
});
