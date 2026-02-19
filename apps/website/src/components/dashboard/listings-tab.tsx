"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { mockListings, type Listing, type Cadence, type ListingStatus } from "@/lib/mock-data"
import {
  StatusBadge,
  SortableHeader,
  FilterChip,
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

export function ListingsTab() {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState("lastUpdated")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const [filterCadence, setFilterCadence] = useState<Cadence | null>(null)
  const [filterStatus, setFilterStatus] = useState<ListingStatus | null>(null)
  const [filterChanged, setFilterChanged] = useState<boolean | null>(null)
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)

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
    let data = [...mockListings]
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.listingId.includes(q) ||
          l.shop.toLowerCase().includes(q),
      )
    }
    if (filterCadence) data = data.filter((l) => l.cadence === filterCadence)
    if (filterStatus) data = data.filter((l) => l.status === filterStatus)
    if (filterChanged !== null) data = data.filter((l) => l.changedRecently === filterChanged)

    data.sort((a, b) => {
      const aVal = a[sortKey as keyof Listing]
      const bVal = b[sortKey as keyof Listing]
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal)
      const bStr = String(bVal)
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })
    return data
  }, [search, sortKey, sortDir, filterCadence, filterStatus, filterChanged])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <TopToolbar search={search} onSearchChange={(v) => { setSearch(v); setPage(1) }} onRefresh={() => {}}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] uppercase tracking-widest text-terminal-dim mr-1">Cadence</span>
          {(["1d", "3d", "7d"] as Cadence[]).map((c) => (
            <FilterChip key={c} label={c} active={filterCadence === c} onClick={() => { setFilterCadence(filterCadence === c ? null : c); setPage(1) }} />
          ))}
          <span className="text-border mx-1">|</span>
          <span className="text-[9px] uppercase tracking-widest text-terminal-dim mr-1">Status</span>
          {(["active", "paused", "error"] as ListingStatus[]).map((s) => (
            <FilterChip key={s} label={s} active={filterStatus === s} onClick={() => { setFilterStatus(filterStatus === s ? null : s); setPage(1) }} />
          ))}
          <span className="text-border mx-1">|</span>
          <FilterChip label="Changed" active={filterChanged === true} onClick={() => { setFilterChanged(filterChanged === true ? null : true); setPage(1) }} />
          <FilterChip label="Unchanged" active={filterChanged === false} onClick={() => { setFilterChanged(filterChanged === false ? null : false); setPage(1) }} />
        </div>
      </TopToolbar>

      <div className="flex-1 overflow-auto">
        {paginated.length === 0 ? (
          <EmptyState message="No listings match your filters." />
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left"><SortableHeader label="Title" sortKey="title" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-2 py-2 text-left"><SortableHeader label="ID" sortKey="listingId" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-2 py-2 text-left"><SortableHeader label="Shop" sortKey="shop" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-2 py-2 text-right"><SortableHeader label="Price" sortKey="currentPrice" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="px-2 py-2 text-right"><SortableHeader label="Sales" sortKey="estimatedSales" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="px-2 py-2 text-right"><SortableHeader label="Reviews" sortKey="reviewCount" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="px-2 py-2 text-right"><SortableHeader label="Rating" sortKey="avgRating" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="px-2 py-2 text-right"><SortableHeader label="Favs" sortKey="favorites" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="px-2 py-2 text-right"><SortableHeader label="Views" sortKey="views" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="px-2 py-2 text-center"><SortableHeader label="Qty" sortKey="quantity" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" /></th>
                <th className="px-2 py-2 text-center"><SortableHeader label="Cad." sortKey="cadence" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" /></th>
                <th className="px-2 py-2 text-right"><SortableHeader label="Updated" sortKey="lastUpdated" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="px-2 py-2 text-right"><SortableHeader label="Next" sortKey="nextRun" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="px-2 py-2 text-center"><SortableHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-center" /></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setSelectedListing(l)}
                  className={cn(
                    "border-b border-border/50 cursor-pointer transition-colors",
                    "hover:bg-accent/50",
                    l.changedRecently && "border-l-[3px] border-l-primary",
                  )}
                >
                  <td className="px-3 py-1.5 max-w-48 truncate text-foreground">{l.title}</td>
                  <td className="px-2 py-1.5 text-terminal-dim font-mono">{l.listingId.slice(-6)}</td>
                  <td className="px-2 py-1.5 text-secondary-foreground">{l.shop}</td>
                  <td className="px-2 py-1.5 text-right text-terminal-green">${l.currentPrice.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right">{formatNumber(l.estimatedSales)}</td>
                  <td className="px-2 py-1.5 text-right text-terminal-dim">{l.reviewCount}</td>
                  <td className="px-2 py-1.5 text-right text-terminal-yellow">{l.avgRating}</td>
                  <td className="px-2 py-1.5 text-right text-terminal-dim">{formatNumber(l.favorites)}</td>
                  <td className="px-2 py-1.5 text-right text-terminal-dim">{formatNumber(l.views)}</td>
                  <td className="px-2 py-1.5 text-center">{l.quantity}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={cn(
                      "text-[10px] px-1 rounded",
                      l.cadence === "1d" ? "text-terminal-green" : l.cadence === "3d" ? "text-terminal-yellow" : "text-terminal-dim",
                    )}>
                      {l.cadence}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right text-terminal-dim text-[10px]">{timeAgo(l.lastUpdated)}</td>
                  <td className="px-2 py-1.5 text-right text-terminal-dim text-[10px]">{timeUntil(l.nextRun)}</td>
                  <td className="px-2 py-1.5 text-center"><StatusBadge status={l.status} /></td>
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
        open={!!selectedListing}
        onClose={() => setSelectedListing(null)}
        title={selectedListing?.title || ""}
        subtitle={selectedListing ? `${selectedListing.id} / ${selectedListing.shop}` : ""}
      >
        {selectedListing && (
          <>
            <div className="space-y-0">
              <DetailRow label="Listing ID" value={selectedListing.listingId} />
              <DetailRow label="Shop" value={selectedListing.shop} />
              <DetailRow label="Price" value={`$${selectedListing.currentPrice.toFixed(2)}`} valueColor="text-terminal-green" />
              <DetailRow label="Estimated Sales" value={formatNumber(selectedListing.estimatedSales)} />
              <DetailRow label="Reviews" value={selectedListing.reviewCount} />
              <DetailRow label="Avg Rating" value={selectedListing.avgRating} valueColor="text-terminal-yellow" />
              <DetailRow label="Favorites" value={formatNumber(selectedListing.favorites)} />
              <DetailRow label="Views" value={formatNumber(selectedListing.views)} />
              <DetailRow label="Quantity" value={selectedListing.quantity} />
              <DetailRow label="Cadence" value={selectedListing.cadence} />
              <DetailRow label="Last Updated" value={timeAgo(selectedListing.lastUpdated)} />
              <DetailRow label="Next Run" value={timeUntil(selectedListing.nextRun)} />
              <DetailRow label="Status" value={<StatusBadge status={selectedListing.status} />} />
              <DetailRow label="Changed Recently" value={selectedListing.changedRecently ? "Yes" : "No"} valueColor={selectedListing.changedRecently ? "text-terminal-yellow" : "text-terminal-dim"} />
            </div>
          </>
        )}
      </DetailPanel>
    </div>
  )
}
