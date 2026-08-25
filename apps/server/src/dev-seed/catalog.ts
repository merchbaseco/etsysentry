/**
 * The vocabulary the seed draws from. Kept apart from the builders so the
 * dataset reads like an Etsy account rather than like `listing-1 … listing-24`,
 * and so widening the catalog never touches generation logic.
 */

export const SHOP_NAMES = [
    'MeadowAndMoss',
    'NorthfieldPaperCo',
    'GildedWrenStudio',
    'SaltAndCedarGoods',
] as const;

export const LISTING_SUBJECTS = [
    'Birth Flower',
    'Constellation',
    'Mountain Range',
    'Wildflower',
    'Sunflower',
    'Terrazzo',
    'Botanical',
    'Coastal Map',
    'Pressed Fern',
    'Moon Phase',
    'Linocut Poppy',
    'Hand-Lettered',
] as const;

export const LISTING_OBJECTS = [
    'Necklace',
    'Art Print',
    'Enamel Pin',
    'Tote Bag',
    'Ceramic Mug',
    'Sticker Sheet',
    'Greeting Card',
    'Linen Tea Towel',
    'Wax Seal Kit',
    'Embroidery Kit',
] as const;

export const LISTING_QUALIFIERS = [
    'Personalized',
    'Custom',
    'Handmade',
    'Minimalist',
    'Vintage-Style',
    'Made to Order',
] as const;

/** Digital listings are excluded from some flows, so a couple must exist. */
export const DIGITAL_OBJECTS = ['Printable Wall Art', 'SVG Cut File Bundle'] as const;

export const TAG_VOCABULARY = [
    'birth flower',
    'personalized gift',
    'botanical art',
    'gift for her',
    'gift for mom',
    'cottagecore',
    'wildflower print',
    'minimalist jewelry',
    'handmade ceramic',
    'wedding favor',
    'bridesmaid gift',
    'nursery decor',
    'kitchen decor',
    'stocking stuffer',
    'enamel pin',
    'sticker pack',
    'moon phase',
    'constellation art',
    'linocut print',
    'hand lettered',
    'coastal decor',
    'mountain art',
    'housewarming gift',
    'teacher gift',
    'anniversary gift',
    'custom name',
    'made to order',
    'small batch',
    'eco friendly',
    'digital download',
] as const;

/** Keywords a shop in this catalog would plausibly be monitoring. */
export const KEYWORD_VOCABULARY = [
    'birth flower necklace',
    'personalized botanical print',
    'wildflower sticker sheet',
    'moon phase wall art',
    'custom name enamel pin',
    'cottagecore ceramic mug',
    'pressed fern art print',
    'linen tea towel handmade',
] as const;

export const SHOP_LOCATIONS = [
    'Portland, OR',
    'Asheville, NC',
    'Providence, RI',
    'Boise, ID',
] as const;

/** Etsy endpoints this server actually calls, for the API-usage panel. */
export const ETSY_ENDPOINTS = [
    'getListing',
    'getShop',
    'findShops',
    'findAllListingsActive',
    'findAllActiveListingsByShop',
] as const;

export const CURRENCY_CODES = ['USD', 'GBP', 'EUR'] as const;

/** Rates against USD, plausible enough for the currency panel to render. */
export const CURRENCY_RATES: Record<string, number> = {
    AUD: 1.52,
    CAD: 1.37,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 151.2,
    USD: 1,
};
