import { homedir } from 'node:os';
import path from 'node:path';

export const CONFIG_DIR = path.join(homedir(), '.etsysentry');
export const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export const RANGE_VALUES = ['7d', '30d', '90d'] as const;
export const METRIC_VALUES = ['views', 'favorites', 'quantity', 'price'] as const;
export const PERFORMANCE_MODE_VALUES = ['metrics', 'table'] as const;

export const TRACKING_STATE_VALUES = ['active', 'paused', 'error'] as const;
export const LISTING_TRACKING_STATE_VALUES = ['active', 'paused', 'error', 'fatal'] as const;
export const SYNC_STATE_VALUES = ['idle', 'queued', 'syncing'] as const;

export const RANGE_ABSOLUTE_REGEX = /^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/;
export const TRAILING_SLASHES_REGEX = /\/+$/;

export const DEFAULT_PRETTY_JSON = true;
