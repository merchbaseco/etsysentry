import type { MouseEvent, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import type { TrackedKeywordItem } from '@/lib/keywords-api';
import { useInfiniteTableWindow } from './use-infinite-table-window';
import {
    createKeywordsColumns,
    getKeywordsColumnMeta
} from './keywords-table-columns';
import { useTableBodyHeight } from './use-table-body-height';

type KeywordsTableProps = {
    items: TrackedKeywordItem[];
    onRefresh: (item: TrackedKeywordItem) => void;
    onSelectKeyword: (item: TrackedKeywordItem) => void;
    refreshingById: Record<string, boolean>;
    resetKey: string;
    selectedKeywordId: string | null;
    scrollContainerRef: RefObject<HTMLDivElement | null>;
};

const ROW_ESTIMATED_HEIGHT_PX = 38;
const VIRTUAL_OVERSCAN_ROWS = 8;
const interactiveElementSelector =
    'a,button,input,select,textarea,[role="button"],[role="link"]';

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
            overflow: 'hidden'
        } as const;
    }

    return {
        display: 'flex',
        flex: '0 0 auto',
        width: params.size,
        overflow: 'hidden'
    } as const;
};

export function KeywordsTable(props: KeywordsTableProps) {
    const { hasMore, renderCount } = useInfiniteTableWindow({
        itemsLength: props.items.length,
        resetKey: props.resetKey,
        scrollContainerRef: props.scrollContainerRef
    });
    const tableItems = useMemo(() => {
        return props.items.slice(0, renderCount);
    }, [props.items, renderCount]);
    const columns = useMemo(() => {
        return createKeywordsColumns({
            onRefresh: props.onRefresh,
            refreshingById: props.refreshingById
        });
    }, [props.onRefresh, props.refreshingById]);
    const table = useReactTable({
        columns,
        data: tableItems,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id
    });
    const rows = table.getRowModel().rows;
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => props.scrollContainerRef.current,
        estimateSize: () => ROW_ESTIMATED_HEIGHT_PX,
        overscan: VIRTUAL_OVERSCAN_ROWS
    });
    const virtualRows = rowVirtualizer.getVirtualItems();
    const headerRef = useRef<HTMLTableSectionElement | null>(null);
    const footerRef = useRef<HTMLDivElement | null>(null);
    const bodyHeight = useTableBodyHeight({
        contentHeight: rowVirtualizer.getTotalSize(),
        headerRef,
        footerRef,
        scrollContainerRef: props.scrollContainerRef
    });

    return (
        <>
            <table className="w-full text-xs" style={{ display: 'grid' }}>
                <thead
                    ref={headerRef}
                    className="sticky top-0 z-10 bg-card"
                    style={{ display: 'grid' }}
                >
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr
                            key={headerGroup.id}
                            className="border-b border-border"
                            style={{ display: 'flex', width: '100%' }}
                        >
                            {headerGroup.headers.map((header) => {
                                const columnMeta = getKeywordsColumnMeta(
                                    header.column.columnDef.meta
                                );

                                return (
                                    <th
                                        key={header.id}
                                        className={cn(columnMeta?.headClassName, 'min-w-0')}
                                        style={toColumnLayout({
                                            size: header.getSize(),
                                            grow: columnMeta?.isGrow
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
                        height: `${bodyHeight}px`
                    }}
                >
                    {virtualRows.map((virtualRow) => {
                        const row = rows[virtualRow.index];
                        const item = row.original;

                        return (
                            <tr
                                key={row.id}
                                ref={(node) => {
                                    if (node) {
                                        rowVirtualizer.measureElement(node);
                                    }
                                }}
                                className={cn(
                                    'absolute left-0 cursor-pointer border-b border-border/50',
                                    props.selectedKeywordId === item.id
                                        ? 'bg-accent/30'
                                        : 'hover:bg-accent/20'
                                )}
                                style={{
                                    display: 'flex',
                                    transform: `translateY(${virtualRow.start}px)`,
                                    width: '100%'
                                }}
                                onClick={(event) => {
                                    if (isInteractiveElementClick(event)) {
                                        return;
                                    }

                                    props.onSelectKeyword(item);
                                }}
                            >
                                {row.getVisibleCells().map((cell) => {
                                    const columnMeta = getKeywordsColumnMeta(
                                        cell.column.columnDef.meta
                                    );

                                    return (
                                        <td
                                            key={cell.id}
                                            className={cn(columnMeta?.cellClassName, 'min-w-0')}
                                            style={toColumnLayout({
                                                size: cell.column.getSize(),
                                                grow: columnMeta?.isGrow
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
                ref={footerRef}
                className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground"
            >
                {hasMore
                    ? `Loaded ${tableItems.length} of ${props.items.length}. Scroll to load more.`
                    : `Showing all ${props.items.length} keywords.`}
            </div>
        </>
    );
}
