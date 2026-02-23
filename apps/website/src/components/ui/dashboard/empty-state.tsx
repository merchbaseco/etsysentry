import { Search } from 'lucide-react';

export function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Search className="mb-3 size-8 opacity-30" />
            <p className="text-xs">{message}</p>
        </div>
    );
}
