import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { MouseEvent, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import type { TrackedListingItem } from '@/lib/listings-api';
import { cn } from '@/lib/utils';
import { createListingsColumns, getListingsColumnMeta } from './listings-table-columns';
import { useInfiniteTableWindow } from './use-infinite-table-window';
import { useTableBodyHeight } from './use-table-body-height';

interface ListingsTableProps {
    items: TrackedListingItem[];
    onRefresh: (item: TrackedListingItem) => void;
    onRowMouseEnter: (event: MouseEvent<HTMLTableRowElement>, item: TrackedListingItem) => void;
    onRowMouseLeave: () => void;
    onRowMouseMove: (event: MouseEvent<HTMLTableRowElement>, item: TrackedListingItem) => void;
    onSelectListing: (item: TrackedListingItem) => void;
    refreshingById: Record<string, boolean>;
    resetKey: string;
    scrollContainerRef: RefObject<HTMLDivElement | null>;
}

const ROW_ESTIMATED_HEIGHT_PX = 62;
const VIRTUAL_OVERSCAN_ROWS = 8;
const interactiveElementSelector = 'a,button,input,select,textarea,[role="button"],[role="link"]';

const isInteractiveElementClick = (event: MouseEvent<HTMLTableRowElement>): boolean => {
    if (!(event.target instanceof Element)) {
        return false;
    }

    return event.target.closest(interactiveElementSelector) !== null;
};

const toColumnLayout = (params: { size: number; grow?: boolean }) => {
    if (params.grow) {
        return {
            display: 'flex',
            flex: '1 1 0',
            minWidth: params.size,
            overflow: 'hidden',
        } as const;
    }

    return {
        display: 'flex',
        flex: '0 0 auto',
        width: params.size,
        overflow: 'hidden',
    } as const;
};

export function ListingsTable(props: ListingsTableProps) {
    const { hasMore, renderCount } = useInfiniteTableWindow({
        itemsLength: props.items.length,
        resetKey: props.resetKey,
        scrollContainerRef: props.scrollContainerRef,
    });
    const tableItems = useMemo(() => {
        return props.items.slice(0, renderCount);
    }, [props.items, renderCount]);
    const columns = useMemo(() => {
        return createListingsColumns({
            onRefresh: props.onRefresh,
            refreshingById: props.refreshingById,
        });
    }, [props.onRefresh, props.refreshingById]);
    const table = useReactTable({
        columns,
        data: tableItems,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
    });
    const rows = table.getRowModel().rows;
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => props.scrollContainerRef.current,
        estimateSize: () => ROW_ESTIMATED_HEIGHT_PX,
        overscan: VIRTUAL_OVERSCAN_ROWS,
    });
    const virtualRows = rowVirtualizer.getVirtualItems();
    const headerRef = useRef<HTMLTableSectionElement | null>(null);
    const footerRef = useRef<HTMLDivElement | null>(null);
    const bodyHeight = useTableBodyHeight({
        contentHeight: rowVirtualizer.getTotalSize(),
        headerRef,
        footerRef,
        scrollContainerRef: props.scrollContainerRef,
    });
    const footerMessage = (() => {
        if (props.items.length === 0) {
            return 'Loading...';
        }

        if (hasMore) {
            return `Loaded ${tableItems.length} of ${props.items.length}. Scroll to load more.`;
        }

        return `Showing all ${props.items.length} listings.`;
    })();

    return (
        <>
            <table
                className="w-full text-xs"
                style={{
                    display: 'grid',
                }}
            >
                <thead
                    className="sticky top-0 z-10 bg-card"
                    ref={headerRef}
                    style={{
                        display: 'grid',
                    }}
                >
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr
                            className="border-border border-b"
                            key={headerGroup.id}
                            style={{
                                display: 'flex',
                                width: '100%',
                            }}
                        >
                            {headerGroup.headers.map((header) => {
                                const columnMeta = getListingsColumnMeta(
                                    header.column.columnDef.meta
                                );

                                return (
                                    <th
                                        className={cn(columnMeta?.headClassName, 'min-w-0')}
                                        key={header.id}
                                        style={toColumnLayout({
                                            size: header.getSize(),
                                            grow: columnMeta?.isGrow,
                                        })}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef.header,
                                                  header.getContext()
                                              )}
                                    </th>
                                );
                            })}
                        </tr>
                    ))}
                </thead>
                <tbody
                    className="relative block"
                    style={{
                        height: `${bodyHeight}px`,
                    }}
                >
                    {virtualRows.map((virtualRow) => {
                        const row = rows[virtualRow.index];
                        const item = row.original;

                        return (
                            <tr
                                className={cn(
                                    'absolute left-0 cursor-pointer border-border/50 border-b',
                                    'transition-colors hover:bg-accent/50'
                                )}
                                data-row-id={item.id}
                                key={row.id}
                                onClick={(event) => {
                                    if (isInteractiveElementClick(event)) {
                                        return;
                                    }

                                    props.onSelectListing(item);
                                }}
                                onMouseEnter={(event) => props.onRowMouseEnter(event, item)}
                                onMouseLeave={props.onRowMouseLeave}
                                onMouseMove={(event) => props.onRowMouseMove(event, item)}
                                ref={(node) => {
                                    if (node) {
                                        rowVirtualizer.measureElement(node);
                                    }
                                }}
                                style={{
                                    display: 'flex',
                                    transform: `translateY(${virtualRow.start}px)`,
                                    width: '100%',
                                }}
                            >
                                {row.getVisibleCells().map((cell) => {
                                    const columnMeta = getListingsColumnMeta(
                                        cell.column.columnDef.meta
                                    );

                                    return (
                                        <td
                                            className={cn(columnMeta?.cellClassName, 'min-w-0')}
                                            key={cell.id}
                                            style={toColumnLayout({
                                                size: cell.column.getSize(),
                                                grow: columnMeta?.isGrow,
                                            })}
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <div
                className="border-border border-t px-3 py-2 text-[10px] text-muted-foreground"
                ref={footerRef}
            >
                {footerMessage}
            </div>
        </>
    );
}
