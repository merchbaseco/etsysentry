import type { PgBoss } from 'pg-boss';
import {
    SYNC_KEYWORD_JOB_NAME,
    type SyncKeywordJobInput
} from '../../jobs/sync-keyword-shared';

export const enqueueSyncKeywordJob = async (params: {
    boss: Pick<PgBoss, 'send'>;
    payload: SyncKeywordJobInput;
}): Promise<string | null> => {
    return params.boss.send(SYNC_KEYWORD_JOB_NAME, params.payload, {
        retryLimit: 0
    });
};
