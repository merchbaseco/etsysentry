import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SortableHeader({
    label,
    sortKey,
    currentSort,
    currentDir,
    onSort,
    className,
}: {
    label: string;
    sortKey: string;
    currentSort: string;
    currentDir: 'asc' | 'desc';
    onSort: (key: string) => void;
    className?: string;
}) {
    const isActive = currentSort === sortKey;
    let sortIcon = <ArrowUpDown className="size-3 opacity-30" />;

    if (isActive) {
        sortIcon =
            currentDir === 'asc' ? (
                <ArrowUp className="size-3" />
            ) : (
                <ArrowDown className="size-3" />
            );
    }

    return (
        <button
            className={cn(
                'inline-flex cursor-pointer select-none items-center gap-1 font-medium text-[10px] uppercase tracking-wider transition-colors hover:text-primary',
                isActive ? 'text-primary' : 'text-muted-foreground',
                className
            )}
            onClick={() => onSort(sortKey)}
            type="button"
        >
            {label}
            <span className="-mr-3.5 inline-flex">{sortIcon}</span>
        </button>
    );
}
