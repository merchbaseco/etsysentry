import type { EtsyGetListingInclude } from '../etsy/bridges/get-listing';

export const trackedListingSyncIncludes = ['Images', 'Shop'] as const satisfies readonly EtsyGetListingInclude[];
