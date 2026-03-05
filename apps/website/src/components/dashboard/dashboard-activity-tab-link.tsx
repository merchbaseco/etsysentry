import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface DashboardActivityTabLinkProps {
    icon: LucideIcon;
    id: string;
    label: string;
    onClose: () => void;
    to: string;
}

export const DashboardActivityTabLink = (props: DashboardActivityTabLinkProps) => {
    const Icon = props.icon;

    return (
        <div className="relative mr-1 shrink-0" key={props.id}>
            <NavLink
                className={({ isActive }) =>
                    cn(
                        'relative flex cursor-pointer items-center gap-1.5 px-3 py-2 pr-7 text-xs transition-colors',
                        isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                    )
                }
                to={props.to}
            >
                {({ isActive }) => (
                    <>
                        <Icon className="size-3.5" />
                        <span className="max-w-48 truncate font-medium">{props.label}</span>
                        {isActive ? (
                            <span className="absolute inset-x-2 bottom-0 h-px bg-primary" />
                        ) : null}
                    </>
                )}
            </NavLink>
            <button
                aria-label={`Close ${props.label}`}
                className="absolute top-1/2 right-1 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded text-terminal-dim transition-colors hover:bg-secondary hover:text-foreground"
                onClick={(event) => {
                    event.preventDefault();
                    props.onClose();
                }}
                type="button"
            >
                <X className="size-3" />
            </button>
        </div>
    );
};
