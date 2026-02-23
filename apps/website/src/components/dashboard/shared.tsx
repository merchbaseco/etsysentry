"use client"

import { useState } from "react"
import {
  Search,
  RefreshCw,
  Calendar,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Eye,
  Star,
  Heart,
  ShoppingCart,
  Clock,
  Activity,
  ChevronLeft,
  ChevronRight,
  Download,
  Play,
  Pause,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ============================================================
// StatusDot
// ============================================================
export function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block size-1.5 rounded-full",
        status === "active" && "bg-terminal-green",
        status === "paused" && "bg-terminal-yellow",
        status === "error" && "bg-terminal-red",
        status === "pending" && "bg-terminal-blue",
        status === "success" && "bg-terminal-green",
        status === "failed" && "bg-terminal-red",
        status === "retrying" && "bg-terminal-yellow",
        status === "partial" && "bg-terminal-yellow",
      )}
    />
  )
}

// ============================================================
// StatusBadge
// ============================================================
export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-medium",
        status === "active" && "bg-terminal-green/10 text-terminal-green",
        status === "paused" && "bg-terminal-yellow/10 text-terminal-yellow",
        status === "error" && "bg-terminal-red/10 text-terminal-red",
        status === "pending" && "bg-terminal-blue/10 text-terminal-blue",
        status === "success" && "bg-terminal-green/10 text-terminal-green",
        status === "failed" && "bg-terminal-red/10 text-terminal-red",
        status === "retrying" && "bg-terminal-yellow/10 text-terminal-yellow",
        status === "partial" && "bg-terminal-yellow/10 text-terminal-yellow",
      )}
    >
      <StatusDot status={status} />
      {status}
    </span>
  )
}

// ============================================================
// MiniSparkline
// ============================================================
export function MiniSparkline({ data, color = "var(--terminal-green)" }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 60
  const h = 16
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg width={w} height={h} className="inline-block">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  )
}

// ============================================================
// SortableHeader
// ============================================================
export function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
  className,
}: {
  label: string
  sortKey: string
  currentSort: string
  currentDir: "asc" | "desc"
  onSort: (key: string) => void
  className?: string
}) {
  const isActive = currentSort === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium cursor-pointer select-none hover:text-primary transition-colors",
        isActive ? "text-primary" : "text-muted-foreground",
        className,
      )}
    >
      {label}
      <span className="inline-flex -mr-3.5">
        {isActive ? (
          currentDir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-30" />
        )}
      </span>
    </button>
  )
}

// ============================================================
// FilterChip
// ============================================================
export function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium transition-colors cursor-pointer",
        active
          ? "bg-primary/15 text-primary border border-primary/30"
          : "bg-secondary text-muted-foreground border border-border hover:text-foreground hover:border-muted-foreground/30",
      )}
    >
      {label}
      {active && <X className="size-2.5" />}
    </button>
  )
}

// ============================================================
// Pagination
// ============================================================
export function Pagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
}: {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
  totalItems: number
  pageSize: number
}) {
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)
  return (
    <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
      <span>
        {start}-{end} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded p-1 hover:bg-secondary disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors"
        >
          <ChevronLeft className="size-3" />
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let p: number
          if (totalPages <= 5) {
            p = i + 1
          } else if (page <= 3) {
            p = i + 1
          } else if (page >= totalPages - 2) {
            p = totalPages - 4 + i
          } else {
            p = page - 2 + i
          }
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                "min-w-5 rounded px-1.5 py-0.5 cursor-pointer transition-colors",
                p === page
                  ? "bg-primary/15 text-primary"
                  : "hover:bg-secondary text-muted-foreground",
              )}
            >
              {p}
            </button>
          )
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded p-1 hover:bg-secondary disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors"
        >
          <ChevronRight className="size-3" />
        </button>
      </div>
    </div>
  )
}

// ============================================================
// TopToolbar
// ============================================================
export function TopToolbar({
  search,
  onSearchChange,
  onRefresh,
  children,
}: {
  search: string
  onSearchChange: (v: string) => void
  onRefresh: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
      <div className="flex items-center gap-1.5 rounded border border-border bg-secondary px-2 py-1 text-xs min-w-48">
        <Search className="size-3 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="bg-transparent text-foreground placeholder:text-muted-foreground outline-none w-full text-xs"
        />
        {search && (
          <button onClick={() => onSearchChange("")} className="cursor-pointer">
            <X className="size-3 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
      {children}
      <div className="flex items-center gap-1 ml-auto">
        <button className="flex items-center gap-1.5 rounded border border-border bg-secondary px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
          <Calendar className="size-3" />
          Last 7d
          <ChevronDown className="size-3" />
        </button>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded border border-border bg-secondary px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        >
          <RefreshCw className="size-3" />
          Refresh
        </button>
      </div>
    </div>
  )
}

// ============================================================
// EmptyState
// ============================================================
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Search className="size-8 mb-3 opacity-30" />
      <p className="text-xs">{message}</p>
    </div>
  )
}

// ============================================================
// DetailPanel
// ============================================================
export function DetailPanel({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md border-l border-border bg-card overflow-y-auto animate-in slide-in-from-right duration-300">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <div>
            <h3 className="text-xs font-semibold text-primary">{title}</h3>
            {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-secondary cursor-pointer transition-colors"
          >
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-4 space-y-4">{children}</div>
      </div>
    </div>
  )
}

// ============================================================
// DetailRow
// ============================================================
export function DetailRow({ label, value, valueColor }: { label: string; value: React.ReactNode; valueColor?: string }) {
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-border/50">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn("text-xs text-right", valueColor || "text-foreground")}>{value}</span>
    </div>
  )
}

// ============================================================
// TimeAgo helper
// ============================================================
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 60000) return "Now"
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `in ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `in ${days}d`
}

// ============================================================
// formatNumber
// ============================================================
export function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toLocaleString()
}

export {
  Search,
  RefreshCw,
  Calendar,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Eye,
  Star,
  Heart,
  ShoppingCart,
  Clock,
  Activity,
  ChevronLeft,
  ChevronRight,
  Download,
  Play,
  Pause,
}
