import { listTrackedKeywords } from '../../../services/keywords/tracked-keywords-service';
import { publicProcedure } from '../../trpc';
import { filterPublicKeywordItems, publicKeywordsListInputSchema } from '../list-filters';

export const publicKeywordsListProcedure = publicProcedure
    .input(publicKeywordsListInputSchema)
    .query(async ({ ctx, input }) => {
        const response = await listTrackedKeywords({
            accountId: ctx.accountId,
        });

        return {
            items: filterPublicKeywordItems(response.items, input),
        };
    });
