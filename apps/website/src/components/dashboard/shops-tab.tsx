"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { mockShops, type Shop, type ListingStatus } from "@/lib/mock-data"
import {
  StatusBadge,
  SortableHeader,
  FilterBar,
  FilterChip,
  FilterGroup,
  TopToolbar,
  Pagination,
  EmptyState,
  DetailPanel,
  DetailRow,
  timeAgo,
  timeUntil,
  formatNumber,
} from "./shared"

const PAGE_SIZE = 15

export function ShopsTab() {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState("totalTrackedListings")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState<ListingStatus | null>(null)
  const [filterActivity, setFilterActivity] = useState<"high" | "medium" | "low" | null>(null)
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)

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
    let data = [...mockShops]
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(
        (s) =>
          s.shopName.toLowerCase().includes(q) ||
          s.shopId.toLowerCase().includes(q),
      )
    }
    if (filterStatus) data = data.filter((s) => s.status === filterStatus)
    if (filterActivity) data = data.filter((s) => s.activityLevel === filterActivity)

    data.sort((a, b) => {
      const aVal = a[sortKey as keyof Shop]
      const bVal = b[sortKey as keyof Shop]
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal)
      const bStr = String(bVal)
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })
    return data
  }, [search, sortKey, sortDir, filterStatus, filterActivity])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <TopToolbar search={search} onSearchChange={(v) => { setSearch(v); setPage(1) }}>
        <FilterBar>
          <FilterGroup label="Status">
            {(["active", "paused", "error"] as ListingStatus[]).map((s) => (
              <FilterChip key={s} label={s} active={filterStatus === s} onClick={() => { setFilterStatus(filterStatus === s ? null : s); setPage(1) }} />
            ))}
          </FilterGroup>
          <FilterGroup label="Activity">
            {(["high", "medium", "low"] as const).map((a) => (
              <FilterChip key={a} label={a} active={filterActivity === a} onClick={() => { setFilterActivity(filterActivity === a ? null : a); setPage(1) }} />
            ))}
          </FilterGroup>
        </FilterBar>
      </TopToolbar>

      <div className="flex-1 overflow-auto">
        {paginated.length === 0 ? (
          <EmptyState message="No shops match your filters." />
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left"><SortableHeader label="Shop" sortKey="shopName" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-2 py-2 text-left"><SortableHeader label="ID" sortKey="shopId" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-2 py-2 text-center"><SortableHeader label="Tracked" sortKey="totalTrackedListings" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" /></th>
                <th className="px-2 py-2 text-center"><SortableHeader label="New" sortKey="newListings" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" /></th>
                <th className="px-2 py-2 text-center"><SortableHeader label="Removed" sortKey="removedListings" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" /></th>
                <th className="px-2 py-2 text-right"><SortableHeader label="Avg Rating" sortKey="avgListingRating" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="px-2 py-2 text-right"><SortableHeader label="Avg Sales" sortKey="avgEstimatedSales" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="px-2 py-2 text-center">
                  <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Activity</span>
                </th>
                <th className="px-2 py-2 text-right"><SortableHeader label="Last Run" sortKey="lastRun" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="px-2 py-2 text-right"><SortableHeader label="Next Run" sortKey="nextRun" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="px-2 py-2 text-center"><SortableHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" /></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelectedShop(s)}
                  className="border-b border-border/50 cursor-pointer transition-colors hover:bg-accent/50"
                >
                  <td className="px-3 py-1.5 text-foreground font-medium">{s.shopName}</td>
                  <td className="px-2 py-1.5 text-terminal-dim font-mono">{s.shopId}</td>
                  <td className="px-2 py-1.5 text-center">{s.totalTrackedListings}</td>
                  <td className="px-2 py-1.5 text-center">
                    {s.newListings > 0 ? (
                      <span className="text-terminal-green">+{s.newListings}</span>
                    ) : (
                      <span className="text-terminal-dim">0</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {s.removedListings > 0 ? (
                      <span className="text-terminal-red">-{s.removedListings}</span>
                    ) : (
                      <span className="text-terminal-dim">0</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right text-terminal-yellow">{s.avgListingRating}</td>
                  <td className="px-2 py-1.5 text-right">{formatNumber(s.avgEstimatedSales)}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider",
                      s.activityLevel === "high" ? "bg-terminal-green/10 text-terminal-green" :
                      s.activityLevel === "medium" ? "bg-terminal-yellow/10 text-terminal-yellow" :
                      "bg-secondary text-terminal-dim",
                    )}>
                      {s.activityLevel}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right text-terminal-dim text-[10px]">{timeAgo(s.lastRun)}</td>
                  <td className="px-2 py-1.5 text-right text-terminal-dim text-[10px]">{timeUntil(s.nextRun)}</td>
                  <td className="px-2 py-1.5 text-center"><StatusBadge status={s.status} /></td>
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
        open={!!selectedShop}
        onClose={() => setSelectedShop(null)}
        title={selectedShop?.shopName || ""}
        subtitle={selectedShop ? `${selectedShop.shopId}` : ""}
      >
        {selectedShop && (
          <div className="space-y-0">
            <DetailRow label="Shop Name" value={selectedShop.shopName} />
            <DetailRow label="Shop ID" value={selectedShop.shopId} />
            <DetailRow label="Total Tracked" value={selectedShop.totalTrackedListings} />
            <DetailRow label="New Listings" value={selectedShop.newListings > 0 ? `+${selectedShop.newListings}` : "0"} valueColor={selectedShop.newListings > 0 ? "text-terminal-green" : "text-terminal-dim"} />
            <DetailRow label="Removed Listings" value={selectedShop.removedListings > 0 ? `-${selectedShop.removedListings}` : "0"} valueColor={selectedShop.removedListings > 0 ? "text-terminal-red" : "text-terminal-dim"} />
            <DetailRow label="Avg Rating" value={selectedShop.avgListingRating} valueColor="text-terminal-yellow" />
            <DetailRow label="Avg Sales" value={formatNumber(selectedShop.avgEstimatedSales)} />
            <DetailRow label="Activity Level" value={selectedShop.activityLevel.toUpperCase()} valueColor={
              selectedShop.activityLevel === "high" ? "text-terminal-green" : selectedShop.activityLevel === "medium" ? "text-terminal-yellow" : "text-terminal-dim"
            } />
            <DetailRow label="Last Run" value={timeAgo(selectedShop.lastRun)} />
            <DetailRow label="Next Run" value={timeUntil(selectedShop.nextRun)} />
            <DetailRow label="Status" value={<StatusBadge status={selectedShop.status} />} />
          </div>
        )}
      </DetailPanel>
    </div>
  )
}
