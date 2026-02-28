'use client';

import { DetailPanel, DetailRow, StatusBadge } from '@/components/ui/dashboard';
import type { EventLogItem } from '@/lib/logs-api';
import {
    formatLogTime,
    getTargetLabel,
    LogLevelBadge,
    PrimitiveTypeBadge,
    toDetailValue,
} from './logs-ui';

export function LogsDetailPanel({
    selectedLog,
    onClose,
}: {
    selectedLog: EventLogItem | null;
    onClose: () => void;
}) {
    const detailEntries = selectedLog ? Object.entries(selectedLog.detailsJson) : [];

    return (
        <DetailPanel
            onClose={onClose}
            open={Boolean(selectedLog)}
            subtitle={selectedLog?.monitorRunId ?? selectedLog?.requestId ?? ''}
            title={selectedLog?.action ?? ''}
        >
            {selectedLog ? (
                <>
                    <div className="space-y-0">
                        <DetailRow label="Time" value={formatLogTime(selectedLog.occurredAt)} />
                        <DetailRow
                            label="Level"
                            value={<LogLevelBadge level={selectedLog.level} />}
                        />
                        <DetailRow label="Action" value={selectedLog.action} />
                        <DetailRow
                            label="Type"
                            value={<PrimitiveTypeBadge type={selectedLog.primitiveType} />}
                        />
                        <DetailRow label="Target" value={getTargetLabel(selectedLog)} />
                        <DetailRow label="Run ID" value={selectedLog.monitorRunId ?? '--'} />
                        <DetailRow label="Request ID" value={selectedLog.requestId ?? '--'} />
                        <DetailRow
                            label="Status"
                            value={<StatusBadge status={selectedLog.status} />}
                        />
                    </div>
                    <div className="mt-4">
                        <h4 className="mb-2 text-[10px] text-muted-foreground uppercase tracking-wider">
                            Message
                        </h4>
                        <div className="rounded border border-border bg-secondary p-3 text-foreground text-sm leading-relaxed">
                            {selectedLog.message}
                        </div>
                    </div>
                    {detailEntries.length > 0 ? (
                        <div className="mt-4">
                            <h4 className="mb-2 text-[10px] text-muted-foreground uppercase tracking-wider">
                                Metadata
                            </h4>
                            <div className="space-y-2 rounded border border-border bg-secondary p-3">
                                {detailEntries.map(([key, value]) => {
                                    const displayValue = toDetailValue(value);
                                    return (
                                        <div className="min-w-0 text-xs" key={key}>
                                            <span className="text-muted-foreground">{key}</span>
                                            <p
                                                className="mt-0.5 truncate font-mono text-foreground leading-relaxed"
                                                title={displayValue}
                                            >
                                                {displayValue}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                </>
            ) : null}
        </DetailPanel>
    );
}
