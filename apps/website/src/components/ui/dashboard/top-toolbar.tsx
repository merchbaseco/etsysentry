import { Search, X } from 'lucide-react';

export function TopToolbar({
    search,
    onSearchChange,
    children,
}: {
    search: string;
    onSearchChange: (value: string) => void;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-center gap-2 border-border border-b px-3 py-1.5">
            <div className="flex min-w-44 items-center gap-1.5 rounded bg-secondary px-2 py-1 text-xs transition-shadow focus-within:ring-1 focus-within:ring-ring/40">
                <Search className="size-3 shrink-0 text-terminal-dim" />
                <input
                    className="w-full bg-transparent text-[11px] text-foreground outline-none placeholder:text-terminal-dim"
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Filter..."
                    type="text"
                    value={search}
                />
                {search ? (
                    <button
                        className="shrink-0 cursor-pointer"
                        onClick={() => onSearchChange('')}
                        type="button"
                    >
                        <X className="size-3 text-terminal-dim transition-colors hover:text-foreground" />
                    </button>
                ) : null}
            </div>
            {children ? (
                <>
                    <span className="h-4 w-px bg-border" />
                    {children}
                </>
            ) : null}
        </div>
    );
}
