import { FilterBar, FilterChip, FilterGroup, TopToolbar } from '@/components/ui/dashboard';
import { cn } from '@/lib/utils';
import { RangeFilter } from './range-filter';

interface ListingsControlsProps {
    favsRange: [number, number];
    isTracking: boolean;
    listingInput: string;
    onFavsRangeChange: (value: [number, number]) => void;
    onListingInputChange: (value: string) => void;
    onPriceRangeChange: (value: [number, number]) => void;
    onSearchChange: (value: string) => void;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    onToggleDigitalListings: () => void;
    onTogglePhysicalListings: () => void;
    priceRange: [number, number];
    search: string;
    showDigitalListings: boolean;
    showPhysicalListings: boolean;
}

export function ListingsControls(props: ListingsControlsProps) {
    return (
        <>
            <TopToolbar onSearchChange={props.onSearchChange} search={props.search}>
                <FilterBar>
                    <FilterGroup label="Price">
                        <RangeFilter
                            max={40}
                            min={0}
                            onChange={props.onPriceRangeChange}
                            prefix="$"
                            value={props.priceRange}
                        />
                    </FilterGroup>
                    <FilterGroup label="Favs">
                        <RangeFilter
                            max={5000}
                            min={0}
                            onChange={props.onFavsRangeChange}
                            step={50}
                            value={props.favsRange}
                        />
                    </FilterGroup>
                    <FilterGroup label="Type">
                        <FilterChip
                            active={props.showPhysicalListings}
                            label="Physical"
                            onClick={props.onTogglePhysicalListings}
                        />
                        <FilterChip
                            active={props.showDigitalListings}
                            label="Digital"
                            onClick={props.onToggleDigitalListings}
                        />
                    </FilterGroup>
                </FilterBar>
            </TopToolbar>
            <form
                className="flex items-center gap-2 border-border border-b px-3 py-2 text-xs"
                onSubmit={props.onSubmit}
            >
                <input
                    className="h-8 flex-1 rounded border border-border bg-secondary px-2 text-xs outline-none placeholder:text-muted-foreground"
                    onChange={(event) => props.onListingInputChange(event.target.value)}
                    placeholder="Paste Etsy listing URL (or listing id)"
                    type="text"
                    value={props.listingInput}
                />
                <button
                    className={cn(
                        'h-8 rounded border border-border bg-secondary px-3 text-[11px] uppercase tracking-wider transition-colors',
                        'disabled:cursor-default disabled:opacity-50',
                        'hover:text-foreground'
                    )}
                    disabled={props.isTracking}
                    type="submit"
                >
                    {props.isTracking ? 'Tracking...' : 'Track Listing'}
                </button>
            </form>
        </>
    );
}
