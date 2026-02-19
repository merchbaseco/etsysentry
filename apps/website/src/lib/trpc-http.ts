export class TrpcRequestError extends Error {
    readonly code?: string;
    readonly httpStatus: number;

    constructor(params: {
        code?: string;
        httpStatus: number;
        message: string;
    }) {
        super(params.message);
        this.name = 'TrpcRequestError';
        this.code = params.code;
        this.httpStatus = params.httpStatus;
    }
}

type TrpcEnvelope<TData> = {
    error?: {
        data?: {
            code?: string;
        };
        message?: string;
    };
    result?: {
        data?:
            | {
                  json: TData;
              }
            | TData;
    };
};

const getApiBaseUrl = (): string => {
    const configuredOrigin = (import.meta.env.VITE_SERVER_ORIGIN as string | undefined)?.trim();

    if (!configuredOrigin) {
        return '/api';
    }

    return `${configuredOrigin.replace(/\/+$/, '')}/api`;
};

const extractData = <TData>(payload: unknown): TData => {
    if (!payload || typeof payload !== 'object') {
        throw new TrpcRequestError({
            httpStatus: 500,
            message: 'tRPC response payload was empty or invalid.'
        });
    }

    const envelope = payload as TrpcEnvelope<TData>;

    if (envelope.error) {
        throw new TrpcRequestError({
            code: envelope.error.data?.code,
            httpStatus: 400,
            message: envelope.error.message ?? 'tRPC request failed.'
        });
    }

    const responseData = envelope.result?.data;

    if (responseData && typeof responseData === 'object' && 'json' in responseData) {
        return responseData.json as TData;
    }

    if (responseData === undefined) {
        throw new TrpcRequestError({
            httpStatus: 500,
            message: 'tRPC response did not include result data.'
        });
    }

    return responseData as TData;
};

const extractErrorMessage = async (response: Response): Promise<string> => {
    const rawText = await response.text();

    try {
        const parsed = JSON.parse(rawText) as TrpcEnvelope<unknown>;
        if (parsed.error?.message) {
            return parsed.error.message;
        }
    } catch {
        // Ignore JSON parse failures.
    }

    if (rawText.trim().length > 0) {
        return rawText;
    }

    return `Request failed with HTTP ${response.status}.`;
};

export const trpcQuery = async <TInput, TOutput>(
    path: string,
    input: TInput
): Promise<TOutput> => {
    const serializedInput = encodeURIComponent(JSON.stringify(input));
    const endpoint = `${getApiBaseUrl()}/${path}?input=${serializedInput}`;

    const response = await fetch(endpoint, {
        headers: {
            Accept: 'application/json'
        },
        method: 'GET'
    });

    if (!response.ok) {
        throw new TrpcRequestError({
            httpStatus: response.status,
            message: await extractErrorMessage(response)
        });
    }

    const payload = (await response.json()) as unknown;
    return extractData<TOutput>(payload);
};

export const trpcMutation = async <TInput, TOutput>(
    path: string,
    input: TInput
): Promise<TOutput> => {
    const endpoint = `${getApiBaseUrl()}/${path}`;

    const response = await fetch(endpoint, {
        body: JSON.stringify({ input }),
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        method: 'POST'
    });

    if (!response.ok) {
        throw new TrpcRequestError({
            httpStatus: response.status,
            message: await extractErrorMessage(response)
        });
    }

    const payload = (await response.json()) as unknown;
    return extractData<TOutput>(payload);
};
