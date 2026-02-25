import type { trackedListings } from '../../db/schema';
import { isTrackedListingSyncInFlight } from './set-tracked-listing-sync-state';

type TrackedListingSyncState = (typeof trackedListings.$inferSelect)['syncState'];
type TrackedListingTrackingState = (typeof trackedListings.$inferSelect)['trackingState'];

export const isTrackedListingSyncEnqueueEligible = (params: {
    syncState: TrackedListingSyncState;
    trackingState: TrackedListingTrackingState;
}): boolean => {
    if (params.trackingState === 'fatal') {
        return false;
    }

    return !isTrackedListingSyncInFlight(params.syncState);
};
