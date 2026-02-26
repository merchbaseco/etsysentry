import {
    realtimeEventSchema,
    type RealtimeEvent
} from './realtime-event-types';

export const serializeEventForWire = (event: RealtimeEvent): string => {
    const parsedEvent = realtimeEventSchema.parse(event);

    switch (parsedEvent.type) {
        case 'sync-state.push':
            return JSON.stringify({
                type: parsedEvent.type,
                entity: parsedEvent.entity,
                ids: parsedEvent.ids
            });
        case 'dashboard-summary.push':
            return JSON.stringify({
                type: parsedEvent.type,
                jobCounts: parsedEvent.jobCounts
            });
        case 'query.invalidate':
            return JSON.stringify({
                type: parsedEvent.type,
                queries: parsedEvent.queries
            });
    }
};

