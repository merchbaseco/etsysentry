const WHITESPACE_REGEX = /\s+/g;

export const normalizeListingTag = (rawTag: string): string | null => {
    const normalized = rawTag.trim().replace(WHITESPACE_REGEX, ' ').toLowerCase();

    if (normalized.length === 0) {
        return null;
    }

    return normalized;
};

export const normalizeListingTags = (rawTags: string[]): string[] => {
    const uniqueTags = new Set<string>();

    for (const rawTag of rawTags) {
        const normalizedTag = normalizeListingTag(rawTag);

        if (!normalizedTag) {
            continue;
        }

        uniqueTags.add(normalizedTag);
    }

    return Array.from(uniqueTags).sort((left, right) => left.localeCompare(right));
};
