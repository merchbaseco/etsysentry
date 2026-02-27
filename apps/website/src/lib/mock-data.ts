// ============================================================
// EtsySentry Mock Data
// ============================================================

export type ListingStatus = 'active' | 'paused' | 'error' | 'pending';
export type Cadence = '1d' | '3d' | '7d';

export interface Listing {
    avgRating: number;
    cadence: Cadence;
    changedRecently: boolean;
    currentPrice: number;
    estimatedSales: number;
    favorites: number;
    id: string;
    lastUpdated: string;
    listingId: string;
    nextRun: string;
    quantity: number;
    reviewCount: number;
    shop: string;
    status: ListingStatus;
    title: string;
    views: number;
}

export interface Keyword {
    avgRank: number;
    bestRank: number;
    id: string;
    keyword: string;
    lastRun: string;
    movement: 'up' | 'down' | 'flat';
    nextRun: string;
    rankTrend: number[];
    status: ListingStatus;
    topRankingListing: string;
    trackedListings: number;
}

export interface Shop {
    activityLevel: 'high' | 'medium' | 'low';
    avgEstimatedSales: number;
    avgListingRating: number;
    id: string;
    lastRun: string;
    newListings: number;
    nextRun: string;
    removedListings: number;
    shopId: string;
    shopName: string;
    status: ListingStatus;
    totalTrackedListings: number;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogStatus = 'success' | 'failed' | 'pending' | 'retrying';

export interface LogEntry {
    action: string;
    id: string;
    level: LogLevel;
    message: string;
    metadata?: Record<string, string>;
    primitiveType: 'listing' | 'shop' | 'keyword' | 'system';
    runId: string;
    status: LogStatus;
    target: string;
    time: string;
}

const shops = [
    'VintageVibes',
    'CraftCorner',
    'RetroTreasures',
    'HandmadeHaven',
    'ArtisanAlley',
    'PixelPrintCo',
    'WoodworkWonder',
    'ThreadNeedle',
    'CeramicDreams',
    'GlassGarden',
];

const listingTitles = [
    'Handmade Ceramic Mug - Speckled Glaze',
    'Vintage Brass Desk Lamp - Art Deco',
    'Custom Leather Journal - Embossed',
    'Macrame Wall Hanging - Bohemian Large',
    'Hand-Poured Soy Candle Set - Lavender',
    'Wooden Cutting Board - Live Edge Walnut',
    'Sterling Silver Ring - Hammered Band',
    'Linen Table Runner - Natural Dye',
    'Stained Glass Sun Catcher - Geometric',
    'Knitted Throw Blanket - Chunky Wool',
    'Resin Coaster Set - Ocean Wave',
    'Embroidered Tote Bag - Floral',
    'Pottery Planter - Raku Fired',
    'Vintage Map Print - Framed 18x24',
    'Beeswax Food Wrap Set - Assorted',
    'Hand-Blown Glass Vase - Cobalt',
    'Crochet Baby Blanket - Pastel Rainbow',
    'Leather Wallet - Bi-Fold Minimalist',
    'Watercolor Art Print - Mountain Sunset',
    'Pressed Flower Frame - Botanical 8x10',
    'Ceramic Serving Bowl - Rustic Stoneware',
    'Woven Basket - Seagrass Storage',
    'Silk Scarf - Hand-Painted Abstract',
    'Wood-Burned Coasters - Tree Ring Design',
    'Clay Earrings - Polymer Botanical',
];

function randomDate(daysAgo: number): string {
    const d = new Date();
    d.setMinutes(d.getMinutes() - Math.floor(Math.random() * daysAgo * 1440));
    return d.toISOString();
}

function futureDate(hoursAhead: number): string {
    const d = new Date();
    d.setMinutes(d.getMinutes() + Math.floor(Math.random() * hoursAhead * 60));
    return d.toISOString();
}

export const mockListings: Listing[] = Array.from({ length: 25 }, (_, i) => ({
    id: `lst-${String(i + 1).padStart(3, '0')}`,
    title: listingTitles[i % listingTitles.length],
    listingId: `${1_000_000_000 + Math.floor(Math.random() * 999_999_999)}`,
    shop: shops[Math.floor(Math.random() * shops.length)],
    currentPrice: +(Math.random() * 180 + 8).toFixed(2),
    estimatedSales: Math.floor(Math.random() * 2400),
    reviewCount: Math.floor(Math.random() * 500),
    avgRating: +(Math.random() * 1.5 + 3.5).toFixed(1),
    favorites: Math.floor(Math.random() * 8000),
    views: Math.floor(Math.random() * 50_000),
    quantity: Math.floor(Math.random() * 100) + 1,
    cadence: (['1d', '3d', '7d'] as Cadence[])[Math.floor(Math.random() * 3)],
    lastUpdated: randomDate(3),
    nextRun: futureDate(24),
    status: (['active', 'active', 'active', 'paused', 'error', 'pending'] as ListingStatus[])[
        Math.floor(Math.random() * 6)
    ],
    changedRecently: Math.random() > 0.6,
}));

const keywords = [
    'handmade ceramic mug',
    'vintage brass lamp',
    'custom leather journal',
    'macrame wall hanging',
    'soy candle lavender',
    'live edge cutting board',
    'sterling silver ring hammered',
    'natural linen runner',
    'stained glass suncatcher',
    'chunky knit blanket',
    'resin ocean coasters',
    'embroidered tote bag',
    'raku pottery planter',
    'beeswax food wrap',
    'hand blown glass vase',
    'crochet baby blanket',
    'minimalist leather wallet',
    'watercolor mountain print',
    'pressed flower art',
    'polymer clay earrings',
];

export const mockKeywords: Keyword[] = keywords.map((kw, i) => {
    const trend = Array.from({ length: 7 }, () => Math.floor(Math.random() * 50) + 1);
    const lastVal = trend.at(-1);
    const prevVal = trend.at(-2);
    let movement: 'down' | 'flat' | 'up' = 'flat';

    if (lastVal < prevVal) {
        movement = 'up';
    } else if (lastVal > prevVal) {
        movement = 'down';
    }

    return {
        id: `kw-${String(i + 1).padStart(3, '0')}`,
        keyword: kw,
        trackedListings: Math.floor(Math.random() * 12) + 1,
        topRankingListing: listingTitles[Math.floor(Math.random() * listingTitles.length)],
        bestRank: Math.floor(Math.random() * 10) + 1,
        avgRank: +(Math.random() * 30 + 5).toFixed(1),
        rankTrend: trend,
        lastRun: randomDate(2),
        nextRun: futureDate(12),
        status: (['active', 'active', 'active', 'paused', 'error'] as ListingStatus[])[
            Math.floor(Math.random() * 5)
        ],
        movement,
    };
});

export const mockShops: Shop[] = shops.map((name, i) => ({
    id: `shop-${String(i + 1).padStart(3, '0')}`,
    shopName: name,
    shopId: `SH${String(10_000 + i)}`,
    totalTrackedListings: Math.floor(Math.random() * 40) + 2,
    newListings: Math.floor(Math.random() * 8),
    removedListings: Math.floor(Math.random() * 4),
    avgListingRating: +(Math.random() * 1 + 4).toFixed(1),
    avgEstimatedSales: Math.floor(Math.random() * 1200 + 50),
    lastRun: randomDate(1),
    nextRun: futureDate(6),
    status: (['active', 'active', 'active', 'paused', 'error'] as ListingStatus[])[
        Math.floor(Math.random() * 5)
    ],
    activityLevel: (['high', 'medium', 'low'] as const)[Math.floor(Math.random() * 3)],
}));

const logActions = [
    'listing.discovered',
    'listing.updated',
    'listing.price_changed',
    'listing.cadence_changed',
    'keyword.rank_captured',
    'keyword.rank_improved',
    'keyword.rank_dropped',
    'shop.listing_added',
    'shop.listing_removed',
    'monitor.started',
    'monitor.completed',
    'monitor.failure',
    'monitor.retry',
    'system.health_check',
    'system.rate_limited',
] as const;

const logMessages = [
    'Captured snapshot for listing #1847291034',
    'Price changed from $24.99 to $22.99',
    'New listing detected in CraftCorner',
    "Rank improved from #18 to #7 for 'handmade ceramic mug'",
    'Monitor run completed in 3.2s, 12 listings updated',
    'Rate limit hit, backing off 30s',
    'Retry attempt 2/3 for keyword rank capture',
    'Shop VintageVibes added 3 new listings',
    'Listing removed: inactive for 14 days',
    'Cadence changed from 7d to 1d for high-activity listing',
    'Health check passed: all monitors operational',
    'Failed to capture data: Etsy API timeout',
    'Listing #1293847561 favorites jumped +127',
    'Monitor batch 24c7f started with 8 targets',
    "Rank data stale: keyword 'vintage brass lamp' not in top 100",
];

const getLogLevel = (action: (typeof logActions)[number]): LogLevel => {
    if (action.includes('failure') || action.includes('rate_limited')) {
        return 'error';
    }

    if (action.includes('retry')) {
        return 'warn';
    }

    if (action.includes('system')) {
        return 'debug';
    }

    return 'info';
};

const getLogStatus = (params: {
    action: (typeof logActions)[number];
    level: LogLevel;
}): LogStatus => {
    if (params.level === 'error') {
        return 'failed';
    }

    if (params.action.includes('retry')) {
        return 'retrying';
    }

    return Math.random() > 0.05 ? 'success' : 'pending';
};

const getLogPrimitiveType = (action: (typeof logActions)[number]): LogEntry['primitiveType'] => {
    if (action.startsWith('listing')) {
        return 'listing';
    }

    if (action.startsWith('keyword')) {
        return 'keyword';
    }

    if (action.startsWith('shop')) {
        return 'shop';
    }

    return 'system';
};

const getLogTarget = (action: (typeof logActions)[number]): string => {
    if (action.startsWith('system')) {
        return 'system';
    }

    if (action.startsWith('listing')) {
        return `lst-${String(Math.floor(Math.random() * 25) + 1).padStart(3, '0')}`;
    }

    if (action.startsWith('keyword')) {
        return `kw-${String(Math.floor(Math.random() * 20) + 1).padStart(3, '0')}`;
    }

    return `shop-${String(Math.floor(Math.random() * 10) + 1).padStart(3, '0')}`;
};

export const mockLogs: LogEntry[] = Array.from({ length: 100 }, (_, i) => {
    const action: (typeof logActions)[number] =
        logActions[Math.floor(Math.random() * logActions.length)];
    const level = getLogLevel(action);
    const status = getLogStatus({
        action,
        level,
    });
    const primitiveType = getLogPrimitiveType(action);

    return {
        id: `log-${String(i + 1).padStart(4, '0')}`,
        time: randomDate(7),
        level,
        action,
        primitiveType,
        target: getLogTarget(action),
        message: logMessages[Math.floor(Math.random() * logMessages.length)],
        runId: `run-${Math.random().toString(36).slice(2, 9)}`,
        status,
        metadata: {
            duration: `${(Math.random() * 5).toFixed(1)}s`,
            retries: String(Math.floor(Math.random() * 3)),
            batchSize: String(Math.floor(Math.random() * 20) + 1),
        },
    };
}).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
