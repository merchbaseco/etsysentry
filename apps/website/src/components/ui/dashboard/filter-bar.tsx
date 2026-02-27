import { Children, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-center gap-1.5" data-slot="filter-group">
            <span className="text-[9px] text-terminal-dim uppercase tracking-widest">{label}</span>
            {children}
        </div>
    );
}

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
    const groups = Children.toArray(children);

    return <div className={cn('flex flex-wrap items-center gap-2', className)}>{groups}</div>;
}
