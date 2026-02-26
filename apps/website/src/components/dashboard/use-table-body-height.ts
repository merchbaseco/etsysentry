import { useEffect, useMemo, useState, type RefObject } from 'react';

type UseTableBodyHeightInput = {
    contentHeight: number;
    headerRef: RefObject<HTMLElement | null>;
    footerRef: RefObject<HTMLElement | null>;
    scrollContainerRef: RefObject<HTMLDivElement | null>;
};

type HeightSnapshot = {
    containerHeight: number;
    footerHeight: number;
    headerHeight: number;
};

const DEFAULT_HEIGHTS: HeightSnapshot = {
    containerHeight: 0,
    footerHeight: 0,
    headerHeight: 0
};

export const useTableBodyHeight = (params: UseTableBodyHeightInput): number => {
    const [heights, setHeights] = useState<HeightSnapshot>(DEFAULT_HEIGHTS);

    useEffect(() => {
        const container = params.scrollContainerRef.current;
        const header = params.headerRef.current;
        const footer = params.footerRef.current;
        if (!container) {
            return;
        }

        const readHeights = () => {
            setHeights({
                containerHeight: container.clientHeight,
                footerHeight: footer?.offsetHeight ?? 0,
                headerHeight: header?.offsetHeight ?? 0
            });
        };

        readHeights();

        const observer = new ResizeObserver(readHeights);
        observer.observe(container);

        if (header) {
            observer.observe(header);
        }

        if (footer) {
            observer.observe(footer);
        }

        return () => {
            observer.disconnect();
        };
    }, [params.footerRef, params.headerRef, params.scrollContainerRef]);

    return useMemo(() => {
        const minBodyHeight = Math.max(
            0,
            heights.containerHeight - heights.headerHeight - heights.footerHeight
        );
        return Math.max(params.contentHeight, minBodyHeight);
    }, [heights, params.contentHeight]);
};
