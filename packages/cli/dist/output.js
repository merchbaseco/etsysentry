import { DEFAULT_PRETTY_JSON } from './constants.js';
const outputPretty = DEFAULT_PRETTY_JSON;
export const printSuccess = (data) => {
    const envelope = {
        ok: true,
        data,
    };
    console.log(JSON.stringify(envelope, null, outputPretty ? 2 : undefined));
};
export const printFailure = (error) => {
    const envelope = {
        ok: false,
        error: {
            code: error.code,
            message: error.message,
            ...(error.details !== undefined ? { details: error.details } : {}),
        },
    };
    console.error(JSON.stringify(envelope, null, outputPretty ? 2 : undefined));
    process.exit(1);
};
