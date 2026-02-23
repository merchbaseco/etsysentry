import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RangeFilterProps {
    value: [number, number];
    min: number;
    max: number;
    step?: number;
    prefix?: string;
    onChange: (range: [number, number]) => void;
}

function RangeInput({
    value,
    min,
    max,
    step,
    prefix,
    onChange,
}: {
    value: number;
    min: number;
    max: number;
    step: number;
    prefix?: string;
    onChange: (n: number) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');

    const commit = () => {
        setEditing(false);
        const parsed = Number.parseInt(draft, 10);

        if (Number.isNaN(parsed)) {
            return;
        }

        onChange(Math.min(max, Math.max(min, parsed)));
    };

    if (editing) {
        return (
            <input
                type="number"
                autoFocus
                value={draft}
                min={min}
                max={max}
                step={step}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') setEditing(false);
                }}
                className="w-10 shrink-0 rounded bg-secondary px-1 py-px text-center text-[10px] text-foreground outline-none ring-1 ring-ring/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
        );
    }

    return (
        <button
            type="button"
            onClick={() => {
                setDraft(String(value));
                setEditing(true);
            }}
            className="w-10 shrink-0 cursor-pointer rounded bg-secondary px-1 py-px text-center text-[10px] text-foreground transition-colors hover:ring-1 hover:ring-ring/40"
        >
            {prefix}{value}
        </button>
    );
}

export function RangeFilter({
    value,
    min,
    max,
    step = 1,
    prefix,
    onChange,
}: RangeFilterProps) {
    const isActive = value[0] > min || value[1] < max;

    return (
        <div className="flex w-56 items-center gap-1.5">
            <RangeInput
                value={value[0]}
                min={min}
                max={value[1]}
                step={step}
                prefix={prefix}
                onChange={(n) => onChange([n, value[1]])}
            />
            <Slider
                value={value}
                min={min}
                max={max}
                step={step}
                onValueChange={(v) => onChange([v[0], v[1]] as [number, number])}
                className={cn(
                    'flex-1',
                    '[&_[data-slot=slider-thumb]]:size-3',
                    '[&_[data-slot=slider-thumb]]:border-primary/80',
                    '[&_[data-slot=slider-track]]:h-1',
                )}
            />
            <RangeInput
                value={value[1]}
                min={value[0]}
                max={max}
                step={step}
                prefix={prefix}
                onChange={(n) => onChange([value[0], n])}
            />
            {isActive ? (
                <button
                    type="button"
                    onClick={() => onChange([min, max])}
                    className="shrink-0 cursor-pointer text-terminal-dim transition-colors hover:text-foreground"
                    aria-label="Clear filter"
                >
                    <X className="size-2.5" />
                </button>
            ) : (
                <span className="size-2.5 shrink-0" />
            )}
        </div>
    );
}
