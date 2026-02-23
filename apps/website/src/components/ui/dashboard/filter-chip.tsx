import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FilterChip({
    label,
    active,
    onClick
}: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-medium transition-colors cursor-pointer',
                active
                    ? 'bg-primary/15 text-primary'
                    : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
            )}
        >
            {label}
            {active ? <X className="size-2.5 opacity-60" /> : null}
        </button>
    );
}
