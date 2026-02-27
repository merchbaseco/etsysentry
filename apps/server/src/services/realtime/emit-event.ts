import { EventEmitter } from 'node:events';
import { type RealtimeEvent, realtimeEventSchema } from './realtime-event-types';
import { serializeEventForWire } from './serialize-realtime-event';

const realtimeInvalidationEmitter = new EventEmitter();
const realtimeInvalidationEventName = 'realtime.invalidation';

realtimeInvalidationEmitter.setMaxListeners(0);

export interface RealtimeWireEvent {
    accountId: string;
    payload: string;
}

export const sendRealtimeEvent = (event: RealtimeEvent): void => {
    const parsedEvent = realtimeEventSchema.parse(event);

    realtimeInvalidationEmitter.emit(realtimeInvalidationEventName, {
        accountId: parsedEvent.accountId,
        payload: serializeEventForWire(parsedEvent),
    } satisfies RealtimeWireEvent);
};

export const onRealtimeEvent = (listener: (event: RealtimeWireEvent) => void): (() => void) => {
    realtimeInvalidationEmitter.on(realtimeInvalidationEventName, listener);

    return () => {
        realtimeInvalidationEmitter.off(realtimeInvalidationEventName, listener);
    };
};

/**
 * @deprecated Use `sendRealtimeEvent` instead.
 */
export const emitRealtimeEvent = sendRealtimeEvent;

/**
 * @deprecated Use `sendRealtimeEvent` instead.
 */
export const emitEvent = sendRealtimeEvent;

/**
 * @deprecated Use `onRealtimeEvent` instead.
 */
export const onEvent = onRealtimeEvent;
