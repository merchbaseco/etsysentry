import { describe, expect, test } from 'bun:test';
import {
    eventLogLevelSchema,
    eventLogPrimitiveTypeSchema,
    eventLogStatusSchema,
} from './event-log-types';

describe('event-log-types', () => {
    test('accepts valid enum values', () => {
        expect(eventLogLevelSchema.parse('info')).toBe('info');
        expect(eventLogStatusSchema.parse('retrying')).toBe('retrying');
        expect(eventLogPrimitiveTypeSchema.parse('listing')).toBe('listing');
    });

    test('rejects invalid enum values', () => {
        expect(() => eventLogLevelSchema.parse('fatal')).toThrow();
        expect(() => eventLogStatusSchema.parse('ok')).toThrow();
        expect(() => eventLogPrimitiveTypeSchema.parse('queue')).toThrow();
    });
});
