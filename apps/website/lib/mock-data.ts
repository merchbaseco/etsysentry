// ============================================================
// EtsySentry Mock Data
// ============================================================

export type ListingStatus = "active" | "paused" | "error" | "pending"
export type Cadence = "1d" | "3d" | "7d"

export interface Listing {
  id: string
  title: string
  listingId: string
  shop: string
  currentPrice: number
  estimatedSales: number
  reviewCount: number
  avgRating: number
  favorites: number
  views: number
  quantity: number
  cadence: Cadence
  lastUpdated: string
  nextRun: string
  status: ListingStatus
  changedRecently: boolean
}

export interface Keyword {
  id: string
  keyword: string
  trackedListings: number
  topRankingListing: string
  bestRank: number
  avgRank: number
  rankTrend: number[]
  lastRun: string
  nextRun: string
  status: ListingStatus
  movement: "up" | "down" | "flat"
}

export interface Shop {
  id: string
  shopName: string
  shopId: string
  totalTrackedListings: number
  newListings: number
  removedListings: number
  avgListingRating: number
  avgEstimatedSales: number
  lastRun: string
  nextRun: string
  status: ListingStatus
  activityLevel: "high" | "medium" | "low"
}

export type LogLevel = "info" | "warn" | "error" | "debug"
export type LogStatus = "success" | "failed" | "pending" | "retrying"

export interface LogEntry {
  id: string
  time: string
  level: LogLevel
  action: string
  primitiveType: "listing" | "shop" | "keyword" | "system"
  target: string
  message: string
  runId: string
  status: LogStatus
  metadata?: Record<string, string>
}

const shops = [
  "VintageVibes",
  "CraftCorner",
  "RetroTreasures",
  "HandmadeHaven",
  "ArtisanAlley",
  "PixelPrintCo",
  "WoodworkWonder",
  "ThreadNeedle",
  "CeramicDreams",
  "GlassGarden",
]

const listingTitles = [
  "Handmade Ceramic Mug - Speckled Glaze",
  "Vintage Brass Desk Lamp - Art Deco",
  "Custom Leather Journal - Embossed",
  "Macrame Wall Hanging - Bohemian Large",
  "Hand-Poured Soy Candle Set - Lavender",
  "Wooden Cutting Board - Live Edge Walnut",
  "Sterling Silver Ring - Hammered Band",
  "Linen Table Runner - Natural Dye",
  "Stained Glass Sun Catcher - Geometric",
  "Knitted Throw Blanket - Chunky Wool",
  "Resin Coaster Set - Ocean Wave",
  "Embroidered Tote Bag - Floral",
  "Pottery Planter - Raku Fired",
  "Vintage Map Print - Framed 18x24",
  "Beeswax Food Wrap Set - Assorted",
  "Hand-Blown Glass Vase - Cobalt",
  "Crochet Baby Blanket - Pastel Rainbow",
  "Leather Wallet - Bi-Fold Minimalist",
  "Watercolor Art Print - Mountain Sunset",
  "Pressed Flower Frame - Botanical 8x10",
  "Ceramic Serving Bowl - Rustic Stoneware",
  "Woven Basket - Seagrass Storage",
  "Silk Scarf - Hand-Painted Abstract",
  "Wood-Burned Coasters - Tree Ring Design",
  "Clay Earrings - Polymer Botanical",
]

function randomDate(daysAgo: number): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - Math.floor(Math.random() * daysAgo * 1440))
  return d.toISOString()
}

function futureDate(hoursAhead: number): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() + Math.floor(Math.random() * hoursAhead * 60))
  return d.toISOString()
}

export const mockListings: Listing[] = Array.from({ length: 25 }, (_, i) => ({
  id: `lst-${String(i + 1).padStart(3, "0")}`,
  title: listingTitles[i % listingTitles.length],
  listingId: `${1000000000 + Math.floor(Math.random() * 999999999)}`,
  shop: shops[Math.floor(Math.random() * shops.length)],
  currentPrice: +(Math.random() * 180 + 8).toFixed(2),
  estimatedSales: Math.floor(Math.random() * 2400),
  reviewCount: Math.floor(Math.random() * 500),
  avgRating: +(Math.random() * 1.5 + 3.5).toFixed(1),
  favorites: Math.floor(Math.random() * 8000),
  views: Math.floor(Math.random() * 50000),
  quantity: Math.floor(Math.random() * 100) + 1,
  cadence: (["1d", "3d", "7d"] as Cadence[])[Math.floor(Math.random() * 3)],
  lastUpdated: randomDate(3),
  nextRun: futureDate(24),
  status: (["active", "active", "active", "paused", "error", "pending"] as ListingStatus[])[Math.floor(Math.random() * 6)],
  changedRecently: Math.random() > 0.6,
}))

const keywords = [
  "handmade ceramic mug",
  "vintage brass lamp",
  "custom leather journal",
  "macrame wall hanging",
  "soy candle lavender",
  "live edge cutting board",
  "sterling silver ring hammered",
  "natural linen runner",
  "stained glass suncatcher",
  "chunky knit blanket",
  "resin ocean coasters",
  "embroidered tote bag",
  "raku pottery planter",
  "beeswax food wrap",
  "hand blown glass vase",
  "crochet baby blanket",
  "minimalist leather wallet",
  "watercolor mountain print",
  "pressed flower art",
  "polymer clay earrings",
]

export const mockKeywords: Keyword[] = keywords.map((kw, i) => {
  const trend = Array.from({ length: 7 }, () => Math.floor(Math.random() * 50) + 1)
  const lastVal = trend[trend.length - 1]
  const prevVal = trend[trend.length - 2]
  return {
    id: `kw-${String(i + 1).padStart(3, "0")}`,
    keyword: kw,
    trackedListings: Math.floor(Math.random() * 12) + 1,
    topRankingListing: listingTitles[Math.floor(Math.random() * listingTitles.length)],
    bestRank: Math.floor(Math.random() * 10) + 1,
    avgRank: +(Math.random() * 30 + 5).toFixed(1),
    rankTrend: trend,
    lastRun: randomDate(2),
    nextRun: futureDate(12),
    status: (["active", "active", "active", "paused", "error"] as ListingStatus[])[Math.floor(Math.random() * 5)],
    movement: lastVal < prevVal ? "up" : lastVal > prevVal ? "down" : "flat",
  }
})

export const mockShops: Shop[] = shops.map((name, i) => ({
  id: `shop-${String(i + 1).padStart(3, "0")}`,
  shopName: name,
  shopId: `SH${String(10000 + i)}`,
  totalTrackedListings: Math.floor(Math.random() * 40) + 2,
  newListings: Math.floor(Math.random() * 8),
  removedListings: Math.floor(Math.random() * 4),
  avgListingRating: +(Math.random() * 1 + 4).toFixed(1),
  avgEstimatedSales: Math.floor(Math.random() * 1200 + 50),
  lastRun: randomDate(1),
  nextRun: futureDate(6),
  status: (["active", "active", "active", "paused", "error"] as ListingStatus[])[Math.floor(Math.random() * 5)],
  activityLevel: (["high", "medium", "low"] as const)[Math.floor(Math.random() * 3)],
}))

const logActions = [
  "listing.discovered",
  "listing.updated",
  "listing.price_changed",
  "listing.cadence_changed",
  "keyword.rank_captured",
  "keyword.rank_improved",
  "keyword.rank_dropped",
  "shop.listing_added",
  "shop.listing_removed",
  "monitor.started",
  "monitor.completed",
  "monitor.failure",
  "monitor.retry",
  "system.health_check",
  "system.rate_limited",
]

const logMessages = [
  "Captured snapshot for listing #1847291034",
  "Price changed from $24.99 to $22.99",
  "New listing detected in CraftCorner",
  "Rank improved from #18 to #7 for 'handmade ceramic mug'",
  "Monitor run completed in 3.2s, 12 listings updated",
  "Rate limit hit, backing off 30s",
  "Retry attempt 2/3 for keyword rank capture",
  "Shop VintageVibes added 3 new listings",
  "Listing removed: inactive for 14 days",
  "Cadence changed from 7d to 1d for high-activity listing",
  "Health check passed: all monitors operational",
  "Failed to capture data: Etsy API timeout",
  "Listing #1293847561 favorites jumped +127",
  "Monitor batch 24c7f started with 8 targets",
  "Rank data stale: keyword 'vintage brass lamp' not in top 100",
]

export const mockLogs: LogEntry[] = Array.from({ length: 100 }, (_, i) => {
  const action = logActions[Math.floor(Math.random() * logActions.length)]
  const level: LogLevel = action.includes("failure") || action.includes("rate_limited")
    ? "error"
    : action.includes("retry")
      ? "warn"
      : action.includes("system")
        ? "debug"
        : "info"
  const status: LogStatus = level === "error"
    ? "failed"
    : action.includes("retry")
      ? "retrying"
      : Math.random() > 0.05
        ? "success"
        : "pending"

  return {
    id: `log-${String(i + 1).padStart(4, "0")}`,
    time: randomDate(7),
    level,
    action,
    primitiveType: action.startsWith("listing")
      ? "listing"
      : action.startsWith("keyword")
        ? "keyword"
        : action.startsWith("shop")
          ? "shop"
          : "system",
    target: action.startsWith("system")
      ? "system"
      : action.startsWith("listing")
        ? `lst-${String(Math.floor(Math.random() * 25) + 1).padStart(3, "0")}`
        : action.startsWith("keyword")
          ? `kw-${String(Math.floor(Math.random() * 20) + 1).padStart(3, "0")}`
          : `shop-${String(Math.floor(Math.random() * 10) + 1).padStart(3, "0")}`,
    message: logMessages[Math.floor(Math.random() * logMessages.length)],
    runId: `run-${Math.random().toString(36).slice(2, 9)}`,
    status,
    metadata: {
      duration: `${(Math.random() * 5).toFixed(1)}s`,
      retries: String(Math.floor(Math.random() * 3)),
      batchSize: String(Math.floor(Math.random() * 20) + 1),
    },
  }
}).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
