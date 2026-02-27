interface TablePoint {
    date: string;
    favorites: number | null;
    price: string | null;
    quantity: number | null;
    views: number | null;
}

const toNumberOrNull = (value: unknown): number | null => {
    return typeof value === 'number' ? value : null;
};

const toPoints = (
    value: unknown
): Array<{ ts: string; value: number | null; currencyCode?: string | null }> => {
    if (!Array.isArray(value)) {
        return [];
    }

    const result: Array<{ ts: string; value: number | null; currencyCode?: string | null }> = [];

    for (const item of value) {
        if (!item || typeof item !== 'object') {
            continue;
        }

        const point = item as Record<string, unknown>;
        const ts = typeof point.ts === 'string' ? point.ts : null;

        if (!ts) {
            continue;
        }

        result.push({
            currencyCode:
                typeof point.currencyCode === 'string' || point.currencyCode === null
                    ? point.currencyCode
                    : undefined,
            ts,
            value: toNumberOrNull(point.value),
        });
    }

    return result;
};

const formatCell = (value: string, width: number): string => {
    return value.padEnd(width, ' ');
};

const buildTable = (rows: TablePoint[]): string => {
    const header = ['date', 'views', 'favorites', 'quantity', 'price'];
    const allRows = rows.map((row) => [
        row.date,
        row.views === null ? '-' : String(row.views),
        row.favorites === null ? '-' : String(row.favorites),
        row.quantity === null ? '-' : String(row.quantity),
        row.price ?? '-',
    ]);

    const widths = header.map((title, index) => {
        const dataWidth = allRows.reduce(
            (max, row) => Math.max(max, row[index].length),
            title.length
        );
        return dataWidth;
    });

    const headerLine = header.map((title, index) => formatCell(title, widths[index])).join('  ');
    const divider = widths.map((width) => '-'.repeat(width)).join('  ');
    const dataLines = allRows.map((row) =>
        row.map((cell, index) => formatCell(cell, widths[index])).join('  ')
    );

    return [headerLine, divider, ...dataLines].join('\n');
};

export const formatPerformanceTable = (data: unknown): string => {
    if (!data || typeof data !== 'object') {
        return 'No performance data.';
    }

    const root = data as Record<string, unknown>;
    const listing = root.listing as Record<string, unknown> | undefined;
    const range = root.range as Record<string, unknown> | undefined;

    const viewsPoints = toPoints((root.views as Record<string, unknown> | undefined)?.points);
    const favoritesPoints = toPoints(
        (root.favorites as Record<string, unknown> | undefined)?.points
    );
    const quantityPoints = toPoints((root.quantity as Record<string, unknown> | undefined)?.points);
    const pricePoints = toPoints((root.price as Record<string, unknown> | undefined)?.points);

    const rowsByDate = new Map<string, TablePoint>();

    const getOrCreateRow = (date: string): TablePoint => {
        const existing = rowsByDate.get(date);

        if (existing) {
            return existing;
        }

        const created: TablePoint = {
            date,
            favorites: null,
            price: null,
            quantity: null,
            views: null,
        };
        rowsByDate.set(date, created);
        return created;
    };

    for (const point of viewsPoints) {
        getOrCreateRow(point.ts).views = point.value;
    }

    for (const point of favoritesPoints) {
        getOrCreateRow(point.ts).favorites = point.value;
    }

    for (const point of quantityPoints) {
        getOrCreateRow(point.ts).quantity = point.value;
    }

    for (const point of pricePoints) {
        const row = getOrCreateRow(point.ts);
        row.price =
            point.value === null
                ? null
                : `${point.value}${point.currencyCode ? ` ${point.currencyCode}` : ''}`;
    }

    const rows = Array.from(rowsByDate.values()).sort((a, b) => a.date.localeCompare(b.date));

    if (rows.length === 0) {
        return 'No performance points for the selected range.';
    }

    const title = typeof listing?.title === 'string' ? listing.title : 'Listing performance';
    const etsyListingId =
        typeof listing?.etsyListingId === 'string' ? listing.etsyListingId : 'unknown';
    const rangeFrom = typeof range?.from === 'string' ? range.from : '?';
    const rangeTo = typeof range?.to === 'string' ? range.to : '?';

    return [
        `${title} (${etsyListingId})`,
        `Range: ${rangeFrom} -> ${rangeTo}`,
        '',
        buildTable(rows),
    ].join('\n');
};
