import { type CSSProperties, type MouseEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const TOOLTIP_SIZE_PX = 176;
const TOOLTIP_GAP_PX = 18;
const VIEWPORT_PADDING_PX = 12;

const clamp = (value: number, min: number, max: number): number => {
    return Math.min(Math.max(value, min), max);
};

type MouseThumbnailTooltipProps = {
    children: ReactNode;
    className?: string;
    imageAlt: string;
    imageUrl: string | null;
};

export function MouseThumbnailTooltip(props: MouseThumbnailTooltipProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCoarsePointer, setIsCoarsePointer] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });

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

    const tooltipStyle = useMemo<CSSProperties>(() => {
        const maxX = window.innerWidth - TOOLTIP_SIZE_PX - VIEWPORT_PADDING_PX;
        const maxY = window.innerHeight - TOOLTIP_SIZE_PX - VIEWPORT_PADDING_PX;

        return {
            left: clamp(
                position.x + TOOLTIP_GAP_PX,
                VIEWPORT_PADDING_PX,
                Math.max(VIEWPORT_PADDING_PX, maxX)
            ),
            top: clamp(
                position.y + TOOLTIP_GAP_PX,
                VIEWPORT_PADDING_PX,
                Math.max(VIEWPORT_PADDING_PX, maxY)
            )
        };
    }, [position.x, position.y]);

    const shouldRenderTooltip = Boolean(props.imageUrl) && !isCoarsePointer;

    const handleMouseEnter = (event: MouseEvent<HTMLSpanElement>) => {
        setPosition({
            x: event.clientX,
            y: event.clientY
        });
        setIsOpen(true);
    };

    const handleMouseMove = (event: MouseEvent<HTMLSpanElement>) => {
        setPosition({
            x: event.clientX,
            y: event.clientY
        });
    };

    const handleMouseLeave = () => {
        setIsOpen(false);
    };

    return (
        <>
            <span
                className={cn(props.className)}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
            >
                {props.children}
            </span>
            {shouldRenderTooltip
                ? createPortal(
                      <div
                          aria-hidden
                          className={cn(
                              'pointer-events-none fixed z-[80] hidden origin-top-left transition-all duration-150 sm:block',
                              isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
                          )}
                          style={tooltipStyle}
                      >
                          <div className="overflow-hidden rounded-md border border-border/70 bg-card shadow-xl">
                              <img
                                  src={props.imageUrl ?? undefined}
                                  alt={props.imageAlt}
                                  className="size-44 max-w-none object-cover"
                              />
                          </div>
                      </div>,
                      document.body
                  )
                : null}
        </>
    );
}
