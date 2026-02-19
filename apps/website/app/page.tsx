"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ListingsTab } from "@/components/dashboard/listings-tab"
import { KeywordsTab } from "@/components/dashboard/keywords-tab"
import { ShopsTab } from "@/components/dashboard/shops-tab"
import { LogsTab } from "@/components/dashboard/logs-tab"
import {
  Activity,
  Eye,
  ShoppingCart,
  Clock,
} from "lucide-react"

const tabs = [
  { id: "listings", label: "Listings", icon: ShoppingCart, count: 25 },
  { id: "keywords", label: "Keywords", icon: Eye, count: 20 },
  { id: "shops", label: "Shops", icon: Activity, count: 10 },
  { id: "logs", label: "Logs", icon: Clock, count: 100 },
] as const

type TabId = (typeof tabs)[number]["id"]

function StatusIndicator() {
  return (
    <div className="flex items-center gap-3 text-[10px]">
      <div className="flex items-center gap-1.5">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-terminal-green opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-terminal-green" />
        </span>
        <span className="text-terminal-green uppercase tracking-wider">Operational</span>
      </div>
      <span className="text-terminal-dim">|</span>
      <span className="text-muted-foreground">
        Last sync: <span className="text-foreground">2m ago</span>
      </span>
      <span className="text-terminal-dim">|</span>
      <span className="text-muted-foreground">
        Monitors: <span className="text-terminal-green">24</span>
        <span className="text-terminal-dim">/</span>
        <span className="text-terminal-yellow">3</span>
        <span className="text-terminal-dim">/</span>
        <span className="text-terminal-red">1</span>
      </span>
    </div>
  )
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("listings")

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2 bg-card">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded bg-primary flex items-center justify-center">
              <span className="text-[10px] font-black text-primary-foreground">ES</span>
            </div>
            <h1 className="text-sm font-bold text-primary tracking-wider">EtsySentry</h1>
          </div>
          <span className="text-border">|</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Monitor Dashboard</span>
        </div>
        <StatusIndicator />
      </header>

      {/* Tab Navigation */}
      <nav className="flex items-center border-b border-border bg-card px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-xs cursor-pointer transition-colors relative",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              <span className="font-medium">{tab.label}</span>
              <span
                className={cn(
                  "text-[9px] rounded px-1 py-px",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-secondary text-terminal-dim",
                )}
              >
                {tab.count}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-px bg-primary" />
              )}
            </button>
          )
        })}

        {/* Summary Stats */}
        <div className="ml-auto flex items-center gap-4 text-[10px] pr-2">
          <div className="flex items-center gap-1.5">
            <span className="text-terminal-dim uppercase tracking-wider">Active</span>
            <span className="text-terminal-green font-bold">42</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-terminal-dim uppercase tracking-wider">Paused</span>
            <span className="text-terminal-yellow font-bold">8</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-terminal-dim uppercase tracking-wider">Errors</span>
            <span className="text-terminal-red font-bold">3</span>
          </div>
        </div>
      </nav>

      {/* Tab Content */}
      <main className="flex-1 overflow-hidden bg-card">
        <div className={cn("h-full", activeTab !== "listings" && "hidden")}>
          <ListingsTab />
        </div>
        <div className={cn("h-full", activeTab !== "keywords" && "hidden")}>
          <KeywordsTab />
        </div>
        <div className={cn("h-full", activeTab !== "shops" && "hidden")}>
          <ShopsTab />
        </div>
        <div className={cn("h-full", activeTab !== "logs" && "hidden")}>
          <LogsTab />
        </div>
      </main>

      {/* Footer Status Bar */}
      <footer className="flex items-center justify-between border-t border-border bg-card px-4 py-1 text-[9px] text-terminal-dim">
        <div className="flex items-center gap-3">
          <span>EtsySentry v0.1.0</span>
          <span>|</span>
          <span>API: <span className="text-terminal-green">Connected</span></span>
          <span>|</span>
          <span>Rate Limit: <span className="text-foreground">847</span>/1000</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Memory: <span className="text-foreground">124MB</span></span>
          <span>|</span>
          <span>Uptime: <span className="text-foreground">14d 7h 32m</span></span>
          <span>|</span>
          <span>{new Date().toISOString().slice(0, 19).replace("T", " ")} UTC</span>
        </div>
      </footer>
    </div>
  )
}
