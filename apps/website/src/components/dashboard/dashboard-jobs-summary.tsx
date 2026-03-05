import { Briefcase } from 'lucide-react';
import { SummaryCount } from '@/components/dashboard/summary-count';
import { useDashboardSummaryQuery } from '@/hooks/use-dashboard-summary-query';
import { cn } from '@/lib/utils';

export const DashboardJobsSummary = () => {
    const { data, isPending } = useDashboardSummaryQuery();
    const queuedJobs = data?.queuedJobs;
    const inFlightJobs = data?.inFlightJobs;
    const hasActive =
        (typeof inFlightJobs === 'number' && inFlightJobs > 0) ||
        (typeof queuedJobs === 'number' && queuedJobs > 0);

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5',
                hasActive
                    ? 'bg-terminal-blue/10 text-terminal-blue'
                    : 'bg-secondary text-muted-foreground'
            )}
        >
            <Briefcase className="size-2.5 text-terminal-dim" />
            <span className="text-terminal-dim uppercase tracking-wider">jobs</span>
            <SummaryCount
                isLoading={isPending}
                minWidthClassName="min-w-[3ch]"
                skeletonWidthClassName="w-[3ch]"
                value={queuedJobs}
                valueClassName={hasActive ? 'text-terminal-blue' : 'text-foreground'}
            />
            <span className="text-terminal-dim uppercase tracking-wider">queued</span>
            <span className="text-terminal-dim">/</span>
            <SummaryCount
                isLoading={isPending}
                minWidthClassName="min-w-[3ch]"
                skeletonWidthClassName="w-[3ch]"
                value={inFlightJobs}
                valueClassName={hasActive ? 'text-terminal-blue' : 'text-foreground'}
            />
            <span className="text-terminal-dim uppercase tracking-wider">in-flight</span>
        </span>
    );
};
