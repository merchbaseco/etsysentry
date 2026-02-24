import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const TOOLTIP_SIZE_PX = 176;
const TOOLTIP_GAP_PX = 14;
const VIEWPORT_PADDING_PX = 12;

const clamp = (value: number, min: number, max: number): number => {
    return Math.min(Math.max(value, min), max);
};

type MouseThumbnailTooltipState = {
    imageAlt: string;
    imageUrl: string | null;
};

type ShowMouseThumbnailTooltipInput = {
    cursorX: number;
    cursorY: number;
    imageAlt: string;
    imageUrl: string | null;
};

const getTooltipPosition = ({
    cursorX,
    cursorY
}: {
    cursorX: number;
    cursorY: number;
}) => {
    const rightEdge = window.innerWidth - VIEWPORT_PADDING_PX;
    const bottomEdge = window.innerHeight - VIEWPORT_PADDING_PX;
    const left =
        cursorX + TOOLTIP_SIZE_PX + TOOLTIP_GAP_PX > rightEdge
            ? cursorX - TOOLTIP_SIZE_PX - TOOLTIP_GAP_PX
            : cursorX + TOOLTIP_GAP_PX;
    const top =
        cursorY + TOOLTIP_SIZE_PX + TOOLTIP_GAP_PX > bottomEdge
            ? cursorY - TOOLTIP_SIZE_PX - TOOLTIP_GAP_PX
            : cursorY + TOOLTIP_GAP_PX;

    return {
        left: clamp(
            left,
            VIEWPORT_PADDING_PX,
            Math.max(VIEWPORT_PADDING_PX, rightEdge - TOOLTIP_SIZE_PX)
        ),
        top: clamp(
            top,
            VIEWPORT_PADDING_PX,
            Math.max(VIEWPORT_PADDING_PX, bottomEdge - TOOLTIP_SIZE_PX)
        )
    };
};

export const useMouseThumbnailTooltip = () => {
    const [tooltip, setTooltip] = useState<MouseThumbnailTooltipState | null>(null);
    const [isCoarsePointer, setIsCoarsePointer] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const tooltipFrameRef = useRef<number | null>(null);
    const tooltipCursorRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const mediaQuery = window.matchMedia('(pointer: coarse)');
        const syncPointerType = () => {
            setIsCoarsePointer(mediaQuery.matches);
        };

        syncPointerType();
        mediaQuery.addEventListener('change', syncPointerType);

        return () => {
            mediaQuery.removeEventListener('change', syncPointerType);
        };
    }, []);

    const applyTooltipPosition = useCallback(() => {
        const node = tooltipRef.current;
        if (!node) {
            return;
        }

        const { x, y } = tooltipCursorRef.current;
        const position = getTooltipPosition({ cursorX: x, cursorY: y });
        node.style.transform = `translate3d(${position.left}px, ${position.top}px, 0)`;
    }, []);

    const queueTooltipPositionUpdate = useCallback(
        (cursorX: number, cursorY: number) => {
            if (isCoarsePointer) {
                return;
            }

            tooltipCursorRef.current = { x: cursorX, y: cursorY };

            if (tooltipFrameRef.current !== null) {
                return;
            }

            tooltipFrameRef.current = window.requestAnimationFrame(() => {
                tooltipFrameRef.current = null;
                applyTooltipPosition();
            });
        },
        [applyTooltipPosition, isCoarsePointer]
    );

    const hideTooltip = useCallback(() => {
        if (tooltipFrameRef.current !== null) {
            window.cancelAnimationFrame(tooltipFrameRef.current);
            tooltipFrameRef.current = null;
        }
        setTooltip(null);
    }, []);

    const showTooltip = useCallback(
        ({ cursorX, cursorY, imageAlt, imageUrl }: ShowMouseThumbnailTooltipInput) => {
            if (isCoarsePointer || !imageUrl) {
                hideTooltip();
                return;
            }

            queueTooltipPositionUpdate(cursorX, cursorY);
            setTooltip({ imageAlt, imageUrl });
        },
        [hideTooltip, isCoarsePointer, queueTooltipPositionUpdate]
    );

    useEffect(() => {
        if (!tooltip) {
            return;
        }
        applyTooltipPosition();
    }, [applyTooltipPosition, tooltip]);

    useEffect(() => {
        return () => {
            if (tooltipFrameRef.current !== null) {
                window.cancelAnimationFrame(tooltipFrameRef.current);
            }
        };
    }, []);

    return {
        hideTooltip,
        queueTooltipPositionUpdate,
        showTooltip,
        tooltip,
        tooltipRef
    };
};

export const MouseThumbnailTooltipPortal = ({
    tooltip,
    tooltipRef
}: {
    tooltip: MouseThumbnailTooltipState | null;
    tooltipRef: RefObject<HTMLDivElement | null>;
}) => {
    if (!tooltip) {
        return null;
    }

    return createPortal(
        <div
            ref={tooltipRef}
            aria-hidden
            className={
                'pointer-events-none fixed left-0 top-0 z-[80] hidden overflow-hidden rounded-md ' +
                'border border-border/70 bg-card shadow-xl will-change-transform sm:block'
            }
        >
            <img
                src={tooltip.imageUrl ?? undefined}
                alt={tooltip.imageAlt}
                className="size-44 max-w-none object-cover"
            />
        </div>,
        document.body
    );
};
