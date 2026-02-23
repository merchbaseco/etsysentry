import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Pagination({
    page,
    totalPages,
    onPageChange,
    totalItems,
    pageSize
}: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    pageSize: number;
}) {
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalItems);

    return (
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
            <span>
                {start}-{end} of {totalItems}
            </span>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="rounded p-1 hover:bg-secondary disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors"
                >
                    <ChevronLeft className="size-3" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
                    let value: number;

                    if (totalPages <= 5) {
                        value = index + 1;
                    } else if (page <= 3) {
                        value = index + 1;
                    } else if (page >= totalPages - 2) {
                        value = totalPages - 4 + index;
                    } else {
                        value = page - 2 + index;
                    }

                    return (
                        <button
                            key={value}
                            onClick={() => onPageChange(value)}
                            className={cn(
                                'min-w-5 rounded px-1.5 py-0.5 cursor-pointer transition-colors',
                                value === page
                                    ? 'bg-primary/15 text-primary'
                                    : 'hover:bg-secondary text-muted-foreground'
                            )}
                        >
                            {value}
                        </button>
                    );
                })}
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="rounded p-1 hover:bg-secondary disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors"
                >
                    <ChevronRight className="size-3" />
                </button>
            </div>
        </div>
    );
}
