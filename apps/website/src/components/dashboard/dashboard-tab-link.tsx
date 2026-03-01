import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface DashboardTabLinkProps {
    icon: LucideIcon;
    label: string;
    to: string;
}

export function DashboardTabLink({ icon: Icon, label, to }: DashboardTabLinkProps) {
    return (
        <NavLink
            className={({ isActive }) =>
                cn(
                    'relative flex cursor-pointer items-center gap-1.5 px-4 py-2 text-xs transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )
            }
            end={to === '/'}
            to={to}
        >
            {({ isActive }) => (
                <>
                    <Icon className="size-3.5" />
                    <span className="font-medium">{label}</span>
                    {isActive ? (
                        <span className="absolute inset-x-2 bottom-0 h-px bg-primary" />
                    ) : null}
                </>
            )}
        </NavLink>
    );
}
