import { cn } from '@/lib/utils';
import {
    FilterBar,
    FilterChip,
    FilterGroup,
    TopToolbar
} from '@/components/ui/dashboard';
import { RangeFilter } from './range-filter';

type ListingsControlsProps = {
    favsRange: [number, number];
    isTracking: boolean;
    listingInput: string;
    onFavsRangeChange: (value: [number, number]) => void;
    onListingInputChange: (value: string) => void;
    onPriceRangeChange: (value: [number, number]) => void;
    onSearchChange: (value: string) => void;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    onToggleShowDigital: () => void;
    priceRange: [number, number];
    search: string;
    showDigitalListings: boolean;
};

export function ListingsControls(props: ListingsControlsProps) {
    return (
        <>
            <TopToolbar search={props.search} onSearchChange={props.onSearchChange}>
                <FilterBar>
                    <FilterGroup label="Price">
                        <RangeFilter
                            value={props.priceRange}
                            min={0}
                            max={40}
                            prefix="$"
                            onChange={props.onPriceRangeChange}
                        />
                    </FilterGroup>
                    <FilterGroup label="Favs">
                        <RangeFilter
                            value={props.favsRange}
                            min={0}
                            max={5000}
                            step={50}
                            onChange={props.onFavsRangeChange}
                        />
                    </FilterGroup>
                    <FilterGroup label="Listings">
                        <FilterChip
                            label="Show digital"
                            active={props.showDigitalListings}
                            onClick={props.onToggleShowDigital}
                        />
                    </FilterGroup>
                </FilterBar>
            </TopToolbar>
            <form
                onSubmit={props.onSubmit}
                className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs"
            >
                <input
                    value={props.listingInput}
                    onChange={(event) => props.onListingInputChange(event.target.value)}
                    type="text"
                    placeholder="Paste Etsy listing URL (or listing id)"
                    className="h-8 flex-1 rounded border border-border bg-secondary px-2 text-xs outline-none placeholder:text-muted-foreground"
                />
                <button
                    type="submit"
                    disabled={props.isTracking}
                    className={cn(
                        'h-8 rounded border border-border bg-secondary px-3 text-[11px] uppercase tracking-wider transition-colors',
                        'disabled:cursor-default disabled:opacity-50',
                        'hover:text-foreground'
                    )}
                >
                    {props.isTracking ? 'Tracking...' : 'Track Listing'}
                </button>
            </form>
        </>
    );
}
