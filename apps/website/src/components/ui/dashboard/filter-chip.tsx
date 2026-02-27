import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FilterChip({
    label,
    active,
    onClick,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            className={cn(
                'inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 font-medium text-[10px] uppercase tracking-wider transition-colors',
                active
                    ? 'bg-primary/15 text-primary'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
            )}
            onClick={onClick}
            type="button"
        >
            {label}
            {active ? <X className="size-2.5 opacity-60" /> : null}
        </button>
    );
}
