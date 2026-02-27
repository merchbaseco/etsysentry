import { failWith } from './errors.js';
import type { CliFlags } from './types.js';

interface ParseIntegerFlagParams {
    flagName: 'limit' | 'offset';
    minimum: number;
    rawValue: string | undefined;
}

export interface ListPagination {
    limit?: number;
    offset: number;
}

const parseIntegerFlag = (params: ParseIntegerFlagParams): number | undefined => {
    if (params.rawValue === undefined) {
        return undefined;
    }

    const parsed = Number(params.rawValue);

    if (!Number.isInteger(parsed) || parsed < params.minimum) {
        failWith({
            code: 'BAD_REQUEST',
            details: {
                minimum: params.minimum,
                value: params.rawValue,
            },
            message: `--${params.flagName} must be an integer >= ${params.minimum}.`,
        });
    }

    return parsed;
};

export const resolveListPagination = (flags: CliFlags): ListPagination => {
    const limit = parseIntegerFlag({
        flagName: 'limit',
        minimum: 1,
        rawValue: flags.limit,
    });
    const offset = parseIntegerFlag({
        flagName: 'offset',
        minimum: 0,
        rawValue: flags.offset,
    });

    return {
        limit,
        offset: offset ?? 0,
    };
};

export const paginateListItems = <T>(items: readonly T[], pagination: ListPagination): T[] => {
    if (pagination.offset >= items.length) {
        return [];
    }

    const pagedItems = items.slice(pagination.offset);

    if (pagination.limit === undefined) {
        return pagedItems;
    }

    return pagedItems.slice(0, pagination.limit);
};
