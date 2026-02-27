import { parseArgs } from 'node:util';
export const parseCliInput = () => {
    const parsed = parseArgs({
        allowPositionals: true,
        args: process.argv.slice(2),
        options: {
            help: { short: 'h', type: 'boolean' },
            'api-key': { type: 'string' },
            'base-url': { type: 'string' },
            metrics: { type: 'string' },
            mode: { type: 'string' },
            range: { type: 'string' },
            search: { type: 'string' },
            'show-digital': { type: 'boolean' },
            'sync-state': { type: 'string' },
            'tracking-state': { type: 'string' },
        },
    });
    return {
        flags: {
            apiKey: parsed.values['api-key'],
            baseUrl: parsed.values['base-url'],
            help: Boolean(parsed.values.help),
            metrics: parsed.values.metrics,
            mode: parsed.values.mode,
            range: parsed.values.range,
            search: parsed.values.search,
            showDigital: Boolean(parsed.values['show-digital']),
            syncState: parsed.values['sync-state'],
            trackingState: parsed.values['tracking-state'],
        },
        positionals: parsed.positionals,
    };
};
export const resolveCommand = (positionals) => {
    const [first, second, ...rest] = positionals;
    if (!first) {
        return null;
    }
    if (first === 'track') {
        if (!second) {
            return null;
        }
        if (second === 'keyword') {
            return {
                args: rest,
                resource: 'keywords',
                verb: 'track',
            };
        }
        if (second === 'listing' || second === 'product') {
            return {
                args: rest,
                resource: 'listings',
                verb: 'track',
            };
        }
        if (second === 'shop') {
            return {
                args: rest,
                resource: 'shops',
                verb: 'track',
            };
        }
        return null;
    }
    if (first === 'products') {
        if (!second) {
            return null;
        }
        return {
            args: rest,
            resource: 'listings',
            verb: second,
        };
    }
    if (!second) {
        return null;
    }
    return {
        args: rest,
        resource: first,
        verb: second,
    };
};
