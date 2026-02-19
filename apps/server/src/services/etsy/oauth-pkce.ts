import { createHash, randomBytes } from 'node:crypto';

const base64UrlEncode = (buffer: Buffer): string => {
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

export const toCodeChallenge = (codeVerifier: string): string => {
    return base64UrlEncode(createHash('sha256').update(codeVerifier).digest());
};

export const createPkcePair = (): {
    codeChallenge: string;
    codeVerifier: string;
} => {
    const codeVerifier = base64UrlEncode(randomBytes(64));
    const codeChallenge = toCodeChallenge(codeVerifier);

    return {
        codeChallenge,
        codeVerifier
    };
};
