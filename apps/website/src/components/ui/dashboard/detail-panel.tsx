import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZE_CLASS = {
    default: 'max-w-lg',
    wide: 'max-w-2xl'
} as const;

export function DetailPanel({
    open,
    onClose,
    title,
    subtitle,
    size = 'default',
    children
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    size?: keyof typeof SIZE_CLASS;
    children: React.ReactNode;
}) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
            <div className={cn('relative z-10 w-full border-l border-border bg-card overflow-y-auto animate-in slide-in-from-right duration-300', SIZE_CLASS[size])}>
                <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card px-5 py-4">
                    <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-primary" title={title}>
                            {title}
                        </h3>
                        {subtitle ? (
                            <p
                                className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground"
                                title={subtitle}
                            >
                                {subtitle}
                            </p>
                        ) : null}
                    </div>
                    <button
                        onClick={onClose}
                        className="shrink-0 rounded p-1.5 hover:bg-secondary cursor-pointer transition-colors"
                    >
                        <X className="size-4 text-muted-foreground" />
                    </button>
                </div>
                <div className={size === 'wide' ? '' : 'space-y-5 p-5'}>{children}</div>
            </div>
        </div>
    );
}

export function DetailRow({
    label,
    value,
    valueColor
}: {
    label: string;
    value: React.ReactNode;
    valueColor?: string;
}) {
    return (
        <div className="flex items-center justify-between gap-4 border-b border-border/50 py-2">
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                {label}
            </span>
            <span
                className={cn(
                    'truncate text-right font-mono text-xs',
                    valueColor ?? 'text-foreground'
                )}
                title={typeof value === 'string' ? value : undefined}
            >
                {value}
            </span>
        </div>
    );
}
