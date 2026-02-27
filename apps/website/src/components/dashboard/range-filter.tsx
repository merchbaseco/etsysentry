import { X } from 'lucide-react';
import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface RangeFilterProps {
    max: number;
    min: number;
    onChange: (range: [number, number]) => void;
    prefix?: string;
    step?: number;
    value: [number, number];
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
                autoFocus
                className="w-10 shrink-0 rounded bg-secondary px-1 py-px text-center text-[10px] text-foreground outline-none ring-1 ring-ring/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                max={max}
                min={min}
                onBlur={commit}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        commit();
                    }
                    if (e.key === 'Escape') {
                        setEditing(false);
                    }
                }}
                step={step}
                type="number"
                value={draft}
            />
        );
    }

    return (
        <button
            className="w-10 shrink-0 cursor-pointer rounded bg-secondary px-1 py-px text-center text-[10px] text-foreground transition-colors hover:ring-1 hover:ring-ring/40"
            onClick={() => {
                setDraft(String(value));
                setEditing(true);
            }}
            type="button"
        >
            {prefix}
            {value}
        </button>
    );
}

export function RangeFilter({ value, min, max, step = 1, prefix, onChange }: RangeFilterProps) {
    const isActive = value[0] > min || value[1] < max;

    return (
        <div className="flex w-56 items-center gap-1.5">
            <RangeInput
                max={value[1]}
                min={min}
                onChange={(n) => onChange([n, value[1]])}
                prefix={prefix}
                step={step}
                value={value[0]}
            />
            <Slider
                className={cn(
                    'flex-1',
                    '[&_[data-slot=slider-thumb]]:size-3',
                    '[&_[data-slot=slider-thumb]]:border-primary/80',
                    '[&_[data-slot=slider-track]]:h-1'
                )}
                max={max}
                min={min}
                onValueChange={(v) => onChange([v[0], v[1]] as [number, number])}
                step={step}
                value={value}
            />
            <RangeInput
                max={max}
                min={value[0]}
                onChange={(n) => onChange([value[0], n])}
                prefix={prefix}
                step={step}
                value={value[1]}
            />
            {isActive ? (
                <button
                    aria-label="Clear filter"
                    className="shrink-0 cursor-pointer text-terminal-dim transition-colors hover:text-foreground"
                    onClick={() => onChange([min, max])}
                    type="button"
                >
                    <X className="size-2.5" />
                </button>
            ) : (
                <span className="size-2.5 shrink-0" />
            )}
        </div>
    );
}
