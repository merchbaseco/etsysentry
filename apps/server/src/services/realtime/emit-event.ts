import { EventEmitter } from 'node:events';
import { z } from 'zod';

const realtimeInvalidationEmitter = new EventEmitter();
const realtimeInvalidationEventName = 'realtime.invalidation';

realtimeInvalidationEmitter.setMaxListeners(0);

export const realtimeInvalidationQuerySchema = z.enum([
    'app.keywords.list',
    'app.listings.list',
    'app.logs.list'
]);

const realtimeInvalidationEventSchema = z.object({
    queries: z.array(realtimeInvalidationQuerySchema).min(1),
    accountId: z.string().min(1)
});

export type RealtimeInvalidationEvent = z.infer<typeof realtimeInvalidationEventSchema>;

export const emitEvent = (event: RealtimeInvalidationEvent): void => {
    const parsedEvent = realtimeInvalidationEventSchema.parse(event);

    realtimeInvalidationEmitter.emit(realtimeInvalidationEventName, parsedEvent);
};

export const onEvent = (
    listener: (event: RealtimeInvalidationEvent) => void
): (() => void) => {
    realtimeInvalidationEmitter.on(realtimeInvalidationEventName, listener);

    return () => {
        realtimeInvalidationEmitter.off(realtimeInvalidationEventName, listener);
    };
};
