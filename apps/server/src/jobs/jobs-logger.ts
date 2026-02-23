export type JobsLogger = {
    error: (payload: unknown, message?: string) => void;
    info: (payload: unknown, message?: string) => void;
    warn: (payload: unknown, message?: string) => void;
};

type LoggerLike = {
    error: (payload: unknown, message?: string) => void;
    info: (payload: unknown, message?: string) => void;
    warn: (payload: unknown, message?: string) => void;
};

const toLogPayload = (scope: string, payload: unknown) => {
    if (typeof payload === 'object' && payload !== null) {
        return {
            scope,
            ...payload
        };
    }

    return {
        payload,
        scope
    };
};

export const createJobsLogger = (params?: {
    baseLogger?: LoggerLike;
    scope?: string;
}): JobsLogger => {
    const scope = params?.scope ?? 'jobs';
    const baseLogger = params?.baseLogger;

    if (!baseLogger) {
        return {
            error(payload, message) {
                console.error(message ?? 'Job error', toLogPayload(scope, payload));
            },
            info(payload, message) {
                console.info(message ?? 'Job info', toLogPayload(scope, payload));
            },
            warn(payload, message) {
                console.warn(message ?? 'Job warning', toLogPayload(scope, payload));
            }
        };
    }

    return {
        error(payload, message) {
            baseLogger.error(toLogPayload(scope, payload), message);
        },
        info(payload, message) {
            baseLogger.info(toLogPayload(scope, payload), message);
        },
        warn(payload, message) {
            baseLogger.warn(toLogPayload(scope, payload), message);
        }
    };
};
