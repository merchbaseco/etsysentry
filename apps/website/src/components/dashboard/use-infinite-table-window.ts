import { type RefObject, useCallback, useEffect, useState } from 'react';
import { getInitialListingsRenderCount, getNextListingsRenderCount } from './listings-tab-utils';

const DEFAULT_PRELOAD_OFFSET_PX = 600;

export interface UseInfiniteTableWindowInput {
    itemsLength: number;
    preloadOffsetPx?: number;
    resetKey: string;
    scrollContainerRef: RefObject<HTMLDivElement | null>;
}

export interface UseInfiniteTableWindowOutput {
    hasMore: boolean;
    renderCount: number;
}

export const useInfiniteTableWindow = (
    params: UseInfiniteTableWindowInput
): UseInfiniteTableWindowOutput => {
    const preloadOffsetPx = params.preloadOffsetPx ?? DEFAULT_PRELOAD_OFFSET_PX;
    const [renderCount, setRenderCount] = useState(() => {
        return getInitialListingsRenderCount(params.itemsLength);
    });

    const hasMore = renderCount < params.itemsLength;
    const loadMore = useCallback(() => {
        setRenderCount((currentCount) => {
            return getNextListingsRenderCount({
                currentCount,
                totalCount: params.itemsLength,
            });
        });
    }, [params.itemsLength]);

    useEffect(() => {
        setRenderCount(getInitialListingsRenderCount(params.itemsLength));
    }, [params.itemsLength]);

    useEffect(() => {
        setRenderCount((currentCount) => {
            if (currentCount === 0) {
                return getInitialListingsRenderCount(params.itemsLength);
            }

            return Math.min(currentCount, params.itemsLength);
        });
    }, [params.itemsLength]);

    useEffect(() => {
        const container = params.scrollContainerRef.current;
        if (!container) {
            return;
        }

        const maybeLoadMore = () => {
            if (!hasMore) {
                return;
            }

            const remainingDistance =
                container.scrollHeight - container.scrollTop - container.clientHeight;

            if (remainingDistance <= preloadOffsetPx) {
                loadMore();
            }
        };

        maybeLoadMore();
        container.addEventListener('scroll', maybeLoadMore, {
            passive: true,
        });

        return () => {
            container.removeEventListener('scroll', maybeLoadMore);
        };
    }, [hasMore, loadMore, params.scrollContainerRef, preloadOffsetPx]);

    return {
        hasMore,
        renderCount,
    };
};
