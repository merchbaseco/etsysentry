import { db } from '../../db';
import { etsyApiCallEvents } from '../../db/schema';

export type RecordEtsyApiCallInput = {
    clerkUserId: string;
    endpoint: string;
    occurredAt?: Date;
    accountId: string;
};

export const recordEtsyApiCall = async (input: RecordEtsyApiCallInput): Promise<void> => {
    await db.insert(etsyApiCallEvents).values({
        clerkUserId: input.clerkUserId,
        createdAt: input.occurredAt ?? new Date(),
        endpoint: input.endpoint,
        accountId: input.accountId
    });
};

export const recordEtsyApiCallBestEffort = async (
    input: RecordEtsyApiCallInput
): Promise<void> => {
    try {
        await recordEtsyApiCall(input);
    } catch (error) {
        console.warn('[EtsyApiCall] Failed to record call event.', {
            clerkUserId: input.clerkUserId,
            endpoint: input.endpoint,
            accountId: input.accountId,
            error
        });
    }
};
