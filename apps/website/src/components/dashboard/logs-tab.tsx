"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { mockLogs, type LogEntry, type LogLevel, type LogStatus } from "@/lib/mock-data"
import {
  StatusBadge,
  SortableHeader,
  FilterChip,
  TopToolbar,
  Pagination,
  EmptyState,
  DetailPanel,
  DetailRow,
  Download,
  Play,
  Pause,
} from "./shared"

const PAGE_SIZE = 20

function LogLevelBadge({ level }: { level: LogLevel }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-bold",
      level === "info" && "text-terminal-blue",
      level === "warn" && "text-terminal-yellow",
      level === "error" && "text-terminal-red",
      level === "debug" && "text-terminal-dim",
    )}>
      {level}
    </span>
  )
}

function PrimitiveTypeBadge({ type }: { type: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded px-1 py-0.5 text-[10px] uppercase tracking-wider",
      type === "listing" && "text-terminal-green bg-terminal-green/5",
      type === "keyword" && "text-terminal-blue bg-terminal-blue/5",
      type === "shop" && "text-terminal-yellow bg-terminal-yellow/5",
      type === "system" && "text-terminal-dim bg-secondary",
    )}>
      {type}
    </span>
  )
}

function formatLogTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export function LogsTab() {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState("time")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const [filterLevel, setFilterLevel] = useState<LogLevel | null>(null)
  const [filterStatus, setFilterStatus] = useState<LogStatus | null>(null)
  const [filterType, setFilterType] = useState<string | null>(null)
  const [liveMode, setLiveMode] = useState(false)
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
    setPage(1)
  }

  const filtered = useMemo(() => {
    let data = [...mockLogs]
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(
        (l) =>
          l.message.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.target.toLowerCase().includes(q) ||
          l.runId.toLowerCase().includes(q),
      )
    }
    if (filterLevel) data = data.filter((l) => l.level === filterLevel)
    if (filterStatus) data = data.filter((l) => l.status === filterStatus)
    if (filterType) data = data.filter((l) => l.primitiveType === filterType)

    data.sort((a, b) => {
      const aVal = a[sortKey as keyof LogEntry]
      const bVal = b[sortKey as keyof LogEntry]
      const aStr = String(aVal)
      const bStr = String(bVal)
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })
    return data
  }, [search, sortKey, sortDir, filterLevel, filterStatus, filterType])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <TopToolbar search={search} onSearchChange={(v) => { setSearch(v); setPage(1) }} onRefresh={() => {}}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] uppercase tracking-widest text-terminal-dim mr-1">Level</span>
          {(["info", "warn", "error", "debug"] as LogLevel[]).map((l) => (
            <FilterChip key={l} label={l} active={filterLevel === l} onClick={() => { setFilterLevel(filterLevel === l ? null : l); setPage(1) }} />
          ))}
          <span className="text-border mx-1">|</span>
          <span className="text-[9px] uppercase tracking-widest text-terminal-dim mr-1">Status</span>
          {(["success", "failed", "retrying", "pending"] as LogStatus[]).map((s) => (
            <FilterChip key={s} label={s} active={filterStatus === s} onClick={() => { setFilterStatus(filterStatus === s ? null : s); setPage(1) }} />
          ))}
          <span className="text-border mx-1">|</span>
          <span className="text-[9px] uppercase tracking-widest text-terminal-dim mr-1">Type</span>
          {(["listing", "keyword", "shop", "system"]).map((t) => (
            <FilterChip key={t} label={t} active={filterType === t} onClick={() => { setFilterType(filterType === t ? null : t); setPage(1) }} />
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => setLiveMode(!liveMode)}
            className={cn(
              "flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] cursor-pointer transition-colors",
              liveMode
                ? "border-terminal-green/30 bg-terminal-green/10 text-terminal-green"
                : "border-border bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {liveMode ? <Pause className="size-3" /> : <Play className="size-3" />}
            {liveMode ? "Live" : "Paused"}
          </button>
          <button className="flex items-center gap-1.5 rounded border border-border bg-secondary px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <Download className="size-3" />
            Export
          </button>
        </div>
      </TopToolbar>

      <div className="flex-1 overflow-auto">
        {paginated.length === 0 ? (
          <EmptyState message="No logs match your filters." />
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left"><SortableHeader label="Time" sortKey="time" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-2 py-2 text-center"><SortableHeader label="Level" sortKey="level" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" /></th>
                <th className="px-2 py-2 text-left"><SortableHeader label="Action" sortKey="action" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-2 py-2 text-center"><SortableHeader label="Type" sortKey="primitiveType" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" /></th>
                <th className="px-2 py-2 text-left"><SortableHeader label="Target" sortKey="target" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-2 py-2 text-left"><SortableHeader label="Message" sortKey="message" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-2 py-2 text-left"><SortableHeader label="Run ID" sortKey="runId" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-2 py-2 text-center"><SortableHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" /></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setSelectedLog(l)}
                  className={cn(
                    "border-b border-border/50 cursor-pointer transition-colors hover:bg-accent/50",
                    l.level === "error" && "bg-terminal-red/3",
                    l.level === "warn" && "bg-terminal-yellow/3",
                  )}
                >
                  <td className="px-3 py-1 text-terminal-dim font-mono whitespace-nowrap">{formatLogTime(l.time)}</td>
                  <td className="px-2 py-1 text-center"><LogLevelBadge level={l.level} /></td>
                  <td className="px-2 py-1 text-foreground font-mono">{l.action}</td>
                  <td className="px-2 py-1 text-center"><PrimitiveTypeBadge type={l.primitiveType} /></td>
                  <td className="px-2 py-1 text-terminal-dim font-mono">{l.target}</td>
                  <td className="px-2 py-1 max-w-64 truncate text-secondary-foreground">{l.message}</td>
                  <td className="px-2 py-1 text-terminal-dim font-mono">{l.runId}</td>
                  <td className="px-2 py-1 text-center"><StatusBadge status={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
      )}

      <DetailPanel
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={selectedLog?.action || ""}
        subtitle={selectedLog ? `${selectedLog.id} / ${selectedLog.runId}` : ""}
      >
        {selectedLog && (
          <>
            <div className="space-y-0">
              <DetailRow label="Time" value={formatLogTime(selectedLog.time)} />
              <DetailRow label="Level" value={<LogLevelBadge level={selectedLog.level} />} />
              <DetailRow label="Action" value={selectedLog.action} />
              <DetailRow label="Type" value={<PrimitiveTypeBadge type={selectedLog.primitiveType} />} />
              <DetailRow label="Target" value={selectedLog.target} />
              <DetailRow label="Run ID" value={selectedLog.runId} />
              <DetailRow label="Status" value={<StatusBadge status={selectedLog.status} />} />
            </div>
            <div className="mt-4">
              <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Message</h4>
              <div className="rounded border border-border bg-secondary p-3 text-[11px] text-foreground leading-relaxed">
                {selectedLog.message}
              </div>
            </div>
            {selectedLog.metadata && (
              <div className="mt-4">
                <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Metadata</h4>
                <div className="rounded border border-border bg-secondary p-3 space-y-1">
                  {Object.entries(selectedLog.metadata).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="text-foreground font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </DetailPanel>
    </div>
  )
}
