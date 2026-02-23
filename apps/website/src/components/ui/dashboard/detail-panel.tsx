import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DetailPanel({
    open,
    onClose,
    title,
    subtitle,
    children
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full max-w-md border-l border-border bg-card overflow-y-auto animate-in slide-in-from-right duration-300">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
                    <div>
                        <h3 className="text-xs font-semibold text-primary">{title}</h3>
                        {subtitle ? (
                            <p className="mt-0.5 text-[10px] text-muted-foreground">{subtitle}</p>
                        ) : null}
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded p-1 hover:bg-secondary cursor-pointer transition-colors"
                    >
                        <X className="size-4 text-muted-foreground" />
                    </button>
                </div>
                <div className="space-y-4 p-4">{children}</div>
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
        <div className="flex items-start justify-between border-b border-border/50 py-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
            <span className={cn('text-right text-xs', valueColor ?? 'text-foreground')}>{value}</span>
        </div>
    );
}
