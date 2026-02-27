import { Download, Pause, Play } from 'lucide-react';
import { FilterBar, FilterChip, FilterGroup, TopToolbar } from '@/components/ui/dashboard';
import type { EventLogLevel, EventLogPrimitiveType, EventLogStatus } from '@/lib/logs-api';
import { cn } from '@/lib/utils';
import { LOG_LEVELS, LOG_STATUSES, LOG_TYPES } from './logs-ui';

interface LogsToolbarProps {
    filterLevel: EventLogLevel | null;
    filterStatus: EventLogStatus | null;
    filterType: EventLogPrimitiveType | null;
    liveMode: boolean;
    onSearchChange: (value: string) => void;
    onToggleFilterLevel: (value: EventLogLevel) => void;
    onToggleFilterStatus: (value: EventLogStatus) => void;
    onToggleFilterType: (value: EventLogPrimitiveType) => void;
    onToggleLiveMode: () => void;
    search: string;
}

export function LogsToolbar(props: LogsToolbarProps) {
    return (
        <TopToolbar onSearchChange={props.onSearchChange} search={props.search}>
            <FilterBar>
                <FilterGroup label="Level">
                    {LOG_LEVELS.map((levelValue) => (
                        <FilterChip
                            active={props.filterLevel === levelValue}
                            key={levelValue}
                            label={levelValue}
                            onClick={() => props.onToggleFilterLevel(levelValue)}
                        />
                    ))}
                </FilterGroup>
                <FilterGroup label="Status">
                    {LOG_STATUSES.map((statusValue) => (
                        <FilterChip
                            active={props.filterStatus === statusValue}
                            key={statusValue}
                            label={statusValue}
                            onClick={() => props.onToggleFilterStatus(statusValue)}
                        />
                    ))}
                </FilterGroup>
                <FilterGroup label="Type">
                    {LOG_TYPES.map((typeValue) => (
                        <FilterChip
                            active={props.filterType === typeValue}
                            key={typeValue}
                            label={typeValue}
                            onClick={() => props.onToggleFilterType(typeValue)}
                        />
                    ))}
                </FilterGroup>
            </FilterBar>
            <div className="ml-auto flex items-center gap-1.5">
                <button
                    className={cn(
                        'flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-[10px] transition-colors',
                        props.liveMode
                            ? 'border-terminal-green/30 bg-terminal-green/10 text-terminal-green'
                            : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                    )}
                    onClick={props.onToggleLiveMode}
                    type="button"
                >
                    {props.liveMode ? <Pause className="size-3" /> : <Play className="size-3" />}
                    {props.liveMode ? 'Live' : 'Paused'}
                </button>
                <button
                    className="flex cursor-pointer items-center gap-1.5 rounded border border-border bg-secondary px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                    type="button"
                >
                    <Download className="size-3" />
                    Export
                </button>
            </div>
        </TopToolbar>
    );
}
