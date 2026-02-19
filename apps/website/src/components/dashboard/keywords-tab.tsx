"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { mockKeywords, type Keyword, type ListingStatus } from "@/lib/mock-data"
import {
  StatusBadge,
  SortableHeader,
  FilterChip,
  TopToolbar,
  Pagination,
  EmptyState,
  DetailPanel,
  DetailRow,
  MiniSparkline,
  timeAgo,
  timeUntil,
  ArrowUp,
  ArrowDown,
} from "./shared"

const PAGE_SIZE = 15

export function KeywordsTab() {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState("bestRank")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState<ListingStatus | null>(null)
  const [filterMovement, setFilterMovement] = useState<"up" | "down" | "flat" | null>(null)
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null)

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "bestRank" || key === "avgRank" ? "asc" : "desc")
    }
    setPage(1)
  }

  const filtered = useMemo(() => {
    let data = [...mockKeywords]
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(
        (k) =>
          k.keyword.toLowerCase().includes(q) ||
          k.topRankingListing.toLowerCase().includes(q),
      )
    }
    if (filterStatus) data = data.filter((k) => k.status === filterStatus)
    if (filterMovement) data = data.filter((k) => k.movement === filterMovement)

    data.sort((a, b) => {
      const aVal = a[sortKey as keyof Keyword]
      const bVal = b[sortKey as keyof Keyword]
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal)
      const bStr = String(bVal)
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })
    return data
  }, [search, sortKey, sortDir, filterStatus, filterMovement])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <TopToolbar search={search} onSearchChange={(v) => { setSearch(v); setPage(1) }} onRefresh={() => {}}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] uppercase tracking-widest text-terminal-dim mr-1">Status</span>
          {(["active", "paused", "error"] as ListingStatus[]).map((s) => (
            <FilterChip key={s} label={s} active={filterStatus === s} onClick={() => { setFilterStatus(filterStatus === s ? null : s); setPage(1) }} />
          ))}
          <span className="text-border mx-1">|</span>
          <span className="text-[9px] uppercase tracking-widest text-terminal-dim mr-1">Movement</span>
          {(["up", "down", "flat"] as const).map((m) => (
            <FilterChip key={m} label={m} active={filterMovement === m} onClick={() => { setFilterMovement(filterMovement === m ? null : m); setPage(1) }} />
          ))}
        </div>
      </TopToolbar>

      <div className="flex-1 overflow-auto">
        {paginated.length === 0 ? (
          <EmptyState message="No keywords match your filters." />
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left"><SortableHeader label="Keyword" sortKey="keyword" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-2 py-2 text-center"><SortableHeader label="Tracked" sortKey="trackedListings" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" /></th>
                <th className="px-2 py-2 text-left"><SortableHeader label="Top Listing" sortKey="topRankingListing" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-2 py-2 text-center"><SortableHeader label="Best" sortKey="bestRank" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" /></th>
                <th className="px-2 py-2 text-center"><SortableHeader label="Avg" sortKey="avgRank" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" /></th>
                <th className="px-2 py-2 text-center">
                  <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Trend</span>
                </th>
                <th className="px-2 py-2 text-center">
                  <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Move</span>
                </th>
                <th className="px-2 py-2 text-right"><SortableHeader label="Last Run" sortKey="lastRun" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="px-2 py-2 text-right"><SortableHeader label="Next Run" sortKey="nextRun" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="px-2 py-2 text-center"><SortableHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" /></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((k) => (
                <tr
                  key={k.id}
                  onClick={() => setSelectedKeyword(k)}
                  className="border-b border-border/50 cursor-pointer transition-colors hover:bg-accent/50"
                >
                  <td className="px-3 py-1.5 text-foreground font-medium">{k.keyword}</td>
                  <td className="px-2 py-1.5 text-center text-terminal-dim">{k.trackedListings}</td>
                  <td className="px-2 py-1.5 max-w-40 truncate text-secondary-foreground">{k.topRankingListing}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={cn(
                      "font-bold",
                      k.bestRank <= 3 ? "text-terminal-green" : k.bestRank <= 10 ? "text-terminal-yellow" : "text-foreground",
                    )}>
                      #{k.bestRank}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center text-terminal-dim">{k.avgRank.toFixed(1)}</td>
                  <td className="px-2 py-1.5 text-center">
                    <MiniSparkline
                      data={k.rankTrend}
                      color={k.movement === "up" ? "var(--terminal-green)" : k.movement === "down" ? "var(--terminal-red)" : "var(--terminal-dim)"}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {k.movement === "up" && <ArrowUp className="size-3 text-terminal-green inline" />}
                    {k.movement === "down" && <ArrowDown className="size-3 text-terminal-red inline" />}
                    {k.movement === "flat" && <span className="text-terminal-dim text-[10px]">--</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right text-terminal-dim text-[10px]">{timeAgo(k.lastRun)}</td>
                  <td className="px-2 py-1.5 text-right text-terminal-dim text-[10px]">{timeUntil(k.nextRun)}</td>
                  <td className="px-2 py-1.5 text-center"><StatusBadge status={k.status} /></td>
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
        open={!!selectedKeyword}
        onClose={() => setSelectedKeyword(null)}
        title={selectedKeyword?.keyword || ""}
        subtitle={selectedKeyword?.id}
      >
        {selectedKeyword && (
          <div className="space-y-0">
            <DetailRow label="Keyword" value={selectedKeyword.keyword} />
            <DetailRow label="Tracked Listings" value={selectedKeyword.trackedListings} />
            <DetailRow label="Top Listing" value={selectedKeyword.topRankingListing} />
            <DetailRow label="Best Rank" value={`#${selectedKeyword.bestRank}`} valueColor="text-terminal-green" />
            <DetailRow label="Avg Rank" value={selectedKeyword.avgRank.toFixed(1)} />
            <DetailRow label="Movement" value={
              <span className={cn(
                selectedKeyword.movement === "up" ? "text-terminal-green" : selectedKeyword.movement === "down" ? "text-terminal-red" : "text-terminal-dim",
              )}>
                {selectedKeyword.movement.toUpperCase()}
              </span>
            } />
            <DetailRow label="Rank Trend" value={
              <MiniSparkline data={selectedKeyword.rankTrend} color={selectedKeyword.movement === "up" ? "var(--terminal-green)" : selectedKeyword.movement === "down" ? "var(--terminal-red)" : "var(--terminal-dim)"} />
            } />
            <DetailRow label="Last Run" value={timeAgo(selectedKeyword.lastRun)} />
            <DetailRow label="Next Run" value={timeUntil(selectedKeyword.nextRun)} />
            <DetailRow label="Status" value={<StatusBadge status={selectedKeyword.status} />} />
          </div>
        )}
      </DetailPanel>
    </div>
  )
}
