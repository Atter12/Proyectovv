"use client";

import { cn } from "@/lib/cn";
import { useState, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  className?: string;
}

export function Tabs({ tabs, defaultTab, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? "");

  const activeContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="scrollbar-thin -mx-1 overflow-x-auto border-b border-[var(--admin-border)] px-1">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/40",
                activeTab === tab.id
                  ? "border-b-2 border-[var(--admin-accent)] text-[var(--admin-accent)]"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="pt-4">{activeContent}</div>
    </div>
  );
}
