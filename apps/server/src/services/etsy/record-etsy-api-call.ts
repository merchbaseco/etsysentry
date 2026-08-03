import { db } from '../../db';
import { etsyApiCallEvents } from '../../db/schema';

export interface RecordEtsyApiCallInput {
    accountId: string;
    endpoint: string;
    occurredAt?: Date;
}

export const recordEtsyApiCall = async (input: RecordEtsyApiCallInput): Promise<void> => {
    await db.insert(etsyApiCallEvents).values({
        createdAt: input.occurredAt ?? new Date(),
        endpoint: input.endpoint,
        accountId: input.accountId,
    });
};

export const recordEtsyApiCallBestEffort = async (input: RecordEtsyApiCallInput): Promise<void> => {
    try {
        await recordEtsyApiCall(input);
    } catch (error) {
        console.warn('[EtsyApiCall] Failed to record call event.', {
            endpoint: input.endpoint,
            accountId: input.accountId,
            error,
        });
    }
};
