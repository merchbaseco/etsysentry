import { createEtsySentryClient } from '@etsysentry/http-client';
import { assertValidRange, resolveApiKey, resolveBaseUrl, resolveRange } from './config.js';
import { failWith } from './errors.js';
import { filterKeywordItems, filterListingItems, filterShopItems, parsePerformanceMetrics, parsePerformanceMode, } from './filters.js';
import { formatPerformanceTable } from './performance-table.js';
const requireArg = (params) => {
    const value = params.args[params.index ?? 0]?.trim();
    if (!value) {
        failWith({
            code: 'BAD_REQUEST',
            message: params.message,
        });
    }
    return value;
};
const createApiClient = (params) => {
    const apiKey = resolveApiKey({
        config: params.config,
        flags: params.flags,
    });
    if (!apiKey) {
        failWith({
            code: 'MISSING_CONFIG',
            message: 'config.apiKey is required',
        });
    }
    return createEtsySentryClient({
        apiKey: apiKey ?? undefined,
        baseUrl: resolveBaseUrl({
            config: params.config,
            flags: params.flags,
        }),
    });
};
const runKeywordsCommand = async (params) => {
    const client = createApiClient(params);
    if (params.command.verb === 'list') {
        const response = await client.queryClient.fetchQuery(client.trpc.public.keywords.list.queryOptions({}));
        return {
            data: {
                items: filterKeywordItems(response.items, params.flags),
            },
            type: 'json',
        };
    }
    if (params.command.verb === 'track') {
        const keyword = params.command.args.join(' ').trim();
        if (!keyword) {
            failWith({
                code: 'BAD_REQUEST',
                message: 'keywords track requires <keyword>.',
            });
        }
        return {
            data: await client.trpcClient.public.keywords.track.mutate({ keyword }),
            type: 'json',
        };
    }
    failWith({
        code: 'BAD_REQUEST',
        message: `Unknown keywords command: ${params.command.verb}`,
    });
    throw new Error('Unreachable');
};
const runListingsCommand = async (params) => {
    const client = createApiClient(params);
    if (params.command.verb === 'list') {
        const response = await client.queryClient.fetchQuery(client.trpc.public.listings.list.queryOptions({}));
        return {
            data: {
                items: filterListingItems(response.items, params.flags),
            },
            type: 'json',
        };
    }
    if (params.command.verb === 'track') {
        const listing = requireArg({
            args: params.command.args,
            message: 'listings track requires <listing_id|listing_url>.',
        });
        return {
            data: await client.trpcClient.public.listings.track.mutate({ listing }),
            type: 'json',
        };
    }
    if (params.command.verb === 'performance') {
        const trackedListingId = requireArg({
            args: params.command.args,
            message: 'listings performance requires <tracked_listing_id>.',
        });
        const mode = parsePerformanceMode(params.flags.mode);
        const range = params.flags.range
            ? assertValidRange(params.flags.range)
            : resolveRange(params);
        const metrics = parsePerformanceMetrics(params.flags.metrics);
        const response = await client.queryClient.fetchQuery(client.trpc.public.listings.getPerformance.queryOptions({
            metrics,
            range,
            trackedListingId,
        }));
        if (mode === 'table') {
            return {
                table: formatPerformanceTable(response),
                type: 'table',
            };
        }
        return {
            data: response,
            type: 'json',
        };
    }
    failWith({
        code: 'BAD_REQUEST',
        message: `Unknown listings command: ${params.command.verb}`,
    });
    throw new Error('Unreachable');
};
const runShopsCommand = async (params) => {
    const client = createApiClient(params);
    if (params.command.verb === 'list') {
        const response = await client.queryClient.fetchQuery(client.trpc.public.shops.list.queryOptions({}));
        return {
            data: {
                items: filterShopItems(response.items, params.flags),
            },
            type: 'json',
        };
    }
    if (params.command.verb === 'track') {
        const shop = requireArg({
            args: params.command.args,
            message: 'shops track requires <shop_id|shop_url|shop_name>.',
        });
        return {
            data: await client.trpcClient.public.shops.track.mutate({ shop }),
            type: 'json',
        };
    }
    failWith({
        code: 'BAD_REQUEST',
        message: `Unknown shops command: ${params.command.verb}`,
    });
    throw new Error('Unreachable');
};
export const runPublicCommand = async (params) => {
    if (params.command.resource === 'keywords') {
        return runKeywordsCommand(params);
    }
    if (params.command.resource === 'listings') {
        return runListingsCommand(params);
    }
    if (params.command.resource === 'shops') {
        return runShopsCommand(params);
    }
    failWith({
        code: 'BAD_REQUEST',
        message: `Unknown resource: ${params.command.resource}`,
    });
    throw new Error('Unreachable');
};
