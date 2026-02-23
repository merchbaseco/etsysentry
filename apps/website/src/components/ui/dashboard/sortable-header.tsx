import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SortableHeader({
    label,
    sortKey,
    currentSort,
    currentDir,
    onSort,
    className
}: {
    label: string;
    sortKey: string;
    currentSort: string;
    currentDir: 'asc' | 'desc';
    onSort: (key: string) => void;
    className?: string;
}) {
    const isActive = currentSort === sortKey;

    return (
        <button
            onClick={() => onSort(sortKey)}
            className={cn(
                'inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium cursor-pointer select-none hover:text-primary transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
                className
            )}
        >
            {label}
            <span className="inline-flex -mr-3.5">
                {isActive ? (
                    currentDir === 'asc' ? (
                        <ArrowUp className="size-3" />
                    ) : (
                        <ArrowDown className="size-3" />
                    )
                ) : (
                    <ArrowUpDown className="size-3 opacity-30" />
                )}
            </span>
        </button>
    );
}
