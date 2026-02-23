import { Children, Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function FilterGroup({
    label,
    children
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div data-slot="filter-group" className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-widest text-terminal-dim">{label}</span>
            {children}
        </div>
    );
}

export function FilterBar({
    children,
    className
}: {
    children: ReactNode;
    className?: string;
}) {
    const groups = Children.toArray(children);

    return (
        <div className={cn('flex flex-wrap items-center gap-2', className)}>
            {groups.map((child, index) => (
                <Fragment key={index}>
                    {index > 0 ? <span className="h-4 w-px bg-border" /> : null}
                    {child}
                </Fragment>
            ))}
        </div>
    );
}
