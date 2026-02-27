import { Search } from 'lucide-react';

export function EmptyState({ message }: { message: string }) {
    return (
        <div
            className={[
                'flex h-full min-h-40 flex-col items-center',
                'justify-center text-muted-foreground',
            ].join(' ')}
        >
            <Search className="mb-3 size-8 opacity-30" />
            <p className="text-xs">{message}</p>
        </div>
    );
}
