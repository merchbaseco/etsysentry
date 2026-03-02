import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { listingTags, tags } from '../../db/schema';
import { normalizeListingTags } from './normalize-listing-tags';

const insertMissingTags = async (normalizedTags: string[]): Promise<void> => {
    if (normalizedTags.length === 0) {
        return;
    }

    await db
        .insert(tags)
        .values(
            normalizedTags.map((normalizedTag) => ({
                normalizedTag,
            }))
        )
        .onConflictDoNothing({
            target: tags.normalizedTag,
        });
};

const getTagIdsByNormalizedTag = async (normalizedTags: string[]): Promise<Map<string, string>> => {
    if (normalizedTags.length === 0) {
        return new Map();
    }

    const rows = await db
        .select({
            id: tags.id,
            normalizedTag: tags.normalizedTag,
        })
        .from(tags)
        .where(inArray(tags.normalizedTag, normalizedTags));

    const mapping = new Map<string, string>();

    for (const row of rows) {
        mapping.set(row.normalizedTag, row.id);
    }

    return mapping;
};

const getExistingTagIdsForListing = async (listingId: string): Promise<Set<string>> => {
    const rows = await db
        .select({
            tagId: listingTags.tagId,
        })
        .from(listingTags)
        .where(eq(listingTags.listingId, listingId));

    return new Set(rows.map((row) => row.tagId));
};

export const syncListingTags = async (params: {
    listingId: string;
    rawTags: string[];
}): Promise<void> => {
    const normalizedTags = normalizeListingTags(params.rawTags);

    if (normalizedTags.length === 0) {
        await db.delete(listingTags).where(eq(listingTags.listingId, params.listingId));
        return;
    }

    await insertMissingTags(normalizedTags);

    const tagIdsByNormalizedTag = await getTagIdsByNormalizedTag(normalizedTags);
    const desiredTagIds = new Set<string>(tagIdsByNormalizedTag.values());
    const existingTagIds = await getExistingTagIdsForListing(params.listingId);
    const tagIdsToInsert: string[] = [];
    const tagIdsToDelete: string[] = [];

    for (const tagId of desiredTagIds) {
        if (!existingTagIds.has(tagId)) {
            tagIdsToInsert.push(tagId);
        }
    }

    for (const existingTagId of existingTagIds) {
        if (!desiredTagIds.has(existingTagId)) {
            tagIdsToDelete.push(existingTagId);
        }
    }

    if (tagIdsToInsert.length > 0) {
        await db
            .insert(listingTags)
            .values(
                tagIdsToInsert.map((tagId) => ({
                    listingId: params.listingId,
                    tagId,
                }))
            )
            .onConflictDoNothing({
                target: [listingTags.listingId, listingTags.tagId],
            });
    }

    if (tagIdsToDelete.length > 0) {
        await db
            .delete(listingTags)
            .where(
                and(
                    eq(listingTags.listingId, params.listingId),
                    inArray(listingTags.tagId, tagIdsToDelete)
                )
            );
    }
};

export const listNormalizedTagsByListingIds = async (params: {
    listingIds: string[];
}): Promise<Record<string, string[]>> => {
    if (params.listingIds.length === 0) {
        return {};
    }

    const rows = await db
        .select({
            listingId: listingTags.listingId,
            normalizedTag: tags.normalizedTag,
        })
        .from(listingTags)
        .innerJoin(tags, eq(listingTags.tagId, tags.id))
        .where(inArray(listingTags.listingId, params.listingIds));

    const tagsByListingId: Record<string, string[]> = {};

    for (const listingId of params.listingIds) {
        tagsByListingId[listingId] = [];
    }

    for (const row of rows) {
        tagsByListingId[row.listingId]?.push(row.normalizedTag);
    }

    for (const listingId of params.listingIds) {
        const normalizedTags = tagsByListingId[listingId];

        if (!normalizedTags) {
            continue;
        }

        normalizedTags.sort((left, right) => left.localeCompare(right));
    }

    return tagsByListingId;
};
