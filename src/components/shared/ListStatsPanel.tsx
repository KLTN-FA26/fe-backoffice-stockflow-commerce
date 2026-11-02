"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { StatTile } from "@/components/shared/StatTile";

export interface ListStatItem {
  label: string;
  value: string;
  icon: LucideIcon;
}

interface ListStatsPanelProps {
  stats: ListStatItem[];
  open: boolean;
  gridClassName?: string;
}

export function ListStatsPanel({ stats, open, gridClassName }: ListStatsPanelProps) {
  return (
    <motion.div
      initial={false}
      animate={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      className="grid overflow-hidden"
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn("mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5", gridClassName)}
        >
          {stats.map((stat) => (
            <StatTile key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
