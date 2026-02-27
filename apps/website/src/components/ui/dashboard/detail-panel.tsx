import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZE_CLASS = {
    default: 'max-w-lg',
    wide: 'max-w-2xl',
} as const;

export function DetailPanel({
    open,
    onClose,
    title,
    subtitle,
    size = 'default',
    children,
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
            <button
                aria-label="Close detail panel"
                className="absolute inset-0 bg-background/60 backdrop-blur-sm"
                onClick={onClose}
                type="button"
            />
            <div
                className={cn(
                    'slide-in-from-right relative z-10 w-full animate-in overflow-y-auto border-border border-l bg-card duration-300',
                    SIZE_CLASS[size]
                )}
            >
                <div className="sticky top-0 z-10 flex items-center gap-3 border-border border-b bg-card px-5 py-4">
                    <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold text-primary text-sm" title={title}>
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
                        className="shrink-0 cursor-pointer rounded p-1.5 transition-colors hover:bg-secondary"
                        onClick={onClose}
                        type="button"
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
    valueColor,
}: {
    label: string;
    value: React.ReactNode;
    valueColor?: string;
}) {
    return (
        <div className="flex items-center justify-between gap-4 border-border/50 border-b py-2">
            <span className="shrink-0 text-[10px] text-muted-foreground uppercase tracking-wider">
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
