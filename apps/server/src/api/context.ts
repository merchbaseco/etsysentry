import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';

export const createTrpcContext = ({ req, res }: CreateFastifyContextOptions) => {
    return {
        request: req,
        reply: res,
        requestId: String(req.id)
    };
};

export type TrpcContext = Awaited<ReturnType<typeof createTrpcContext>>;
