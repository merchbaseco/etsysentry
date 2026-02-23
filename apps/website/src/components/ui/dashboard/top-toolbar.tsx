import { Search, X } from 'lucide-react';

export function TopToolbar({
    search,
    onSearchChange,
    children
}: {
    search: string;
    onSearchChange: (value: string) => void;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5">
            <div className="flex items-center gap-1.5 rounded bg-secondary px-2 py-1 text-xs min-w-44 focus-within:ring-1 focus-within:ring-ring/40 transition-shadow">
                <Search className="size-3 shrink-0 text-terminal-dim" />
                <input
                    type="text"
                    placeholder="Filter..."
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    className="bg-transparent text-foreground placeholder:text-terminal-dim outline-none w-full text-[11px]"
                />
                {search ? (
                    <button onClick={() => onSearchChange('')} className="cursor-pointer shrink-0">
                        <X className="size-3 text-terminal-dim hover:text-foreground transition-colors" />
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
