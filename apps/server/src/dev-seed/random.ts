/**
 * Small deterministic generator so a seed run is varied but reproducible: the
 * same seed string always produces the same catalog and the same rank history,
 * while a new seed produces a different plausible account. Lehmer's
 * multiplicative generator, because it needs no bitwise arithmetic and every
 * intermediate stays inside a double.
 */

const MODULUS = 2_147_483_647;
const MULTIPLIER = 48_271;
const HASH_MULTIPLIER = 31;
const BYTE_RANGE = 256;
const HEX_RADIX = 16;
const UUID_BYTES = 16;
const UUID_VERSION_INDEX = 6;
const UUID_VARIANT_INDEX = 8;

export interface SeededRandom {
    /** Uniform float in [min, max). */
    between(min: number, max: number): number;
    /** True with the given probability. */
    chance(probability: number): boolean;
    /** Uniform integer in [min, max]. */
    int(min: number, max: number): number;
    /** Uniform float in [0, 1). */
    next(): number;
    /** Uniform element of a non-empty list. */
    pick<T>(values: readonly T[]): T;
    /** Small count around the given mean, Knuth's Poisson sampler. */
    poisson(mean: number): number;
    /** A copy of the list in a deterministic shuffled order. */
    shuffle<T>(values: readonly T[]): T[];
    /** A deterministic RFC 4122 version-4 shaped UUID. */
    uuid(): string;
}

export const createSeededRandom = (seed: string): SeededRandom => {
    let state = hashSeed(seed);

    const next = (): number => {
        state = (state * MULTIPLIER) % MODULUS;
        return (state - 1) / (MODULUS - 1);
    };

    const between = (min: number, max: number): number => min + next() * (max - min);

    const int = (min: number, max: number): number => Math.floor(between(min, max + 1));

    const pick = <T>(values: readonly T[]): T => {
        const value = values[int(0, values.length - 1)];

        if (value === undefined) {
            throw new Error('Cannot pick from an empty list.');
        }

        return value;
    };

    const poisson = (mean: number): number => {
        if (mean <= 0) {
            return 0;
        }

        const limit = Math.exp(-mean);
        let count = 0;
        let product = next();

        while (product > limit) {
            count += 1;
            product *= next();
        }

        return count;
    };

    const shuffle = <T>(values: readonly T[]): T[] => {
        const shuffled = [...values];

        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const swapIndex = int(0, index);
            const current = shuffled[index];
            const swap = shuffled[swapIndex];

            if (current !== undefined && swap !== undefined) {
                shuffled[index] = swap;
                shuffled[swapIndex] = current;
            }
        }

        return shuffled;
    };

    // Primary keys are UUIDs and rows reference each other, so the ids have to
    // come from the same reproducible stream as everything else rather than
    // from `crypto.randomUUID`.
    const uuid = (): string => {
        const bytes = Array.from({ length: UUID_BYTES }, () => int(0, BYTE_RANGE - 1));
        // Version 4 and the RFC variant, stamped with modular arithmetic so
        // this module stays bitwise-free like the generator above it.
        bytes[UUID_VERSION_INDEX] = ((bytes[UUID_VERSION_INDEX] ?? 0) % 16) + 0x40;
        bytes[UUID_VARIANT_INDEX] = ((bytes[UUID_VARIANT_INDEX] ?? 0) % 64) + 0x80;

        const hex = bytes.map((byte) => byte.toString(HEX_RADIX).padStart(2, '0')).join('');

        return [
            hex.slice(0, 8),
            hex.slice(8, 12),
            hex.slice(12, 16),
            hex.slice(16, 20),
            hex.slice(20, 32),
        ].join('-');
    };

    return {
        between,
        chance: (probability: number) => next() < probability,
        int,
        next,
        pick,
        poisson,
        shuffle,
        uuid,
    };
};

/** Polynomial hash into the generator's non-zero state range. */
const hashSeed = (seed: string): number => {
    let hash = 7;

    for (let index = 0; index < seed.length; index += 1) {
        hash = (hash * HASH_MULTIPLIER + seed.charCodeAt(index)) % MODULUS;
    }

    return hash === 0 ? 1 : hash;
};
