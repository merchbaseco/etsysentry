import { z } from 'zod';

export const eventLogLevels = ['info', 'warn', 'error', 'debug'] as const;
export const eventLogStatuses = ['success', 'failed', 'pending', 'retrying', 'partial'] as const;
export const eventLogPrimitiveTypes = ['keyword', 'listing', 'shop', 'system'] as const;

export const eventLogLevelSchema = z.enum(eventLogLevels);
export const eventLogStatusSchema = z.enum(eventLogStatuses);
export const eventLogPrimitiveTypeSchema = z.enum(eventLogPrimitiveTypes);

export const eventLogDetailsSchema = z.record(z.string(), z.unknown());

export type EventLogLevel = z.infer<typeof eventLogLevelSchema>;
export type EventLogStatus = z.infer<typeof eventLogStatusSchema>;
export type EventLogPrimitiveType = z.infer<typeof eventLogPrimitiveTypeSchema>;
export type EventLogDetails = z.infer<typeof eventLogDetailsSchema>;
