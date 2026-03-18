import { homedir } from 'node:os';
import path from 'node:path';

export const DEFAULT_STORAGE_DIR = path.join(homedir(), '.etsysentry');
export const CONFIG_FILENAME = 'config.json';
export const DEFAULT_CONFIG_PATH = path.join(DEFAULT_STORAGE_DIR, CONFIG_FILENAME);
export const GLOBAL_CONFIG_PATH = path.join(DEFAULT_STORAGE_DIR, 'settings.json');
export const DEFAULT_BASE_URL = 'https://etsysentry.merchbase.co';
export const CLI_SECURE_STORE_SERVICE = 'com.etsysentry.cli';
export const CLI_SECURE_STORE_ACCOUNT = 'api-key';

export const RANGE_VALUES = ['7d', '30d', '90d'] as const;
export const METRIC_VALUES = ['views', 'favorites', 'quantity', 'price'] as const;
export const PERFORMANCE_MODE_VALUES = ['metrics', 'table'] as const;

export const TRACKING_STATE_VALUES = ['active', 'paused', 'error'] as const;
export const LISTING_TRACKING_STATE_VALUES = ['active', 'paused', 'error', 'fatal'] as const;
export const SYNC_STATE_VALUES = ['idle', 'queued', 'syncing'] as const;

export const RANGE_ABSOLUTE_REGEX = /^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/;
export const TRAILING_SLASHES_REGEX = /\/+$/;

export const DEFAULT_PRETTY_JSON = true;
