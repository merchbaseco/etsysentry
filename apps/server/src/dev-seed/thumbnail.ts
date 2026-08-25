/**
 * Listing thumbnails as inline data URIs. A cloud dev VM has no route to
 * `i.etsystatic.com` and a fabricated Etsy URL would 404 anyway, so the seed
 * carries its own art: every listing renders a real image in the table and the
 * hover tooltip, and nothing on the page reaches the network.
 */

const SWATCHES = [
    ['#f2e8cf', '#6a994e'],
    ['#e9edc9', '#bc6c25'],
    ['#f5ebe0', '#a26769'],
    ['#e0e1dd', '#415a77'],
    ['#fef6e4', '#f582ae'],
    ['#e8e8e4', '#8a817c'],
] as const;

const SIZE = 160;
const LEADING_LETTER = /^[A-Za-z]/u;

const toInitials = (title: string): string =>
    title
        .split(' ')
        .filter((word) => LEADING_LETTER.test(word))
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? '')
        .join('');

export const buildThumbnailDataUri = (params: { swatchIndex: number; title: string }): string => {
    const swatch = SWATCHES[params.swatchIndex % SWATCHES.length] ?? SWATCHES[0];
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">` +
        `<rect width="${SIZE}" height="${SIZE}" fill="${swatch[0]}"/>` +
        `<circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 3}" fill="${swatch[1]}"/>` +
        `<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" ` +
        `font-family="Helvetica,Arial,sans-serif" font-size="44" fill="${swatch[0]}">` +
        `${toInitials(params.title)}</text></svg>`;

    return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
};
