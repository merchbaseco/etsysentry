import type { trackedListings } from '../../db/schema';

type TrackedListingSortableRow = Pick<
    typeof trackedListings.$inferSelect,
    'createdAt' | 'listingId'
>;

export const compareTrackedListingRowsByCreatedAtDesc = (
    left: TrackedListingSortableRow,
    right: TrackedListingSortableRow
): number => {
    const createdAtDelta = right.createdAt.getTime() - left.createdAt.getTime();

    if (createdAtDelta !== 0) {
        return createdAtDelta;
    }

    return right.listingId.localeCompare(left.listingId);
};

export const sortTrackedListingRowsByCreatedAtDesc = <T extends TrackedListingSortableRow>(
    rows: readonly T[]
): T[] => {
    return [...rows].sort(compareTrackedListingRowsByCreatedAtDesc);
};
