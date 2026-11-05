"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { REPORTING_LABELS } from "@/constants/reporting";

import { formatNumber } from "@/lib/format";

import type { StatusBar } from "../selectors";

const TICK = { fill: "var(--ink-tertiary)", fontSize: 11 };

/** Horizontal bars, one per order status, coloured by the shared status tone. Loaded via next/dynamic. */
export default function OrderStatusChart({ bars }: { bars: readonly StatusBar[] }) {
  return (
    <div style={{ height: Math.max(120, bars.length * 30 + 24) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={[...bars]}
          layout="vertical"
          margin={{ top: 4, right: 24, bottom: 4, left: 0 }}
        >
          <CartesianGrid
            stroke="var(--border-default)"
            strokeDasharray="3 3"
            opacity={0.6}
            horizontal={false}
          />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={TICK}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={TICK}
            axisLine={false}
            tickLine={false}
            width={120}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: "var(--bg-muted)", opacity: 0.5 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as StatusBar;
              return (
                <div className="bg-bg-surface border-border-default rounded-[var(--r-sm)] border px-3 py-2 text-xs shadow-md">
                  <p className="text-ink-primary font-medium">{p.label}</p>
                  <p className="text-ink-secondary mt-0.5 font-mono tabular-nums">
                    {REPORTING_LABELS.orders}: {formatNumber(p.count)}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
            {bars.map((bar) => (
              <Cell key={bar.code} fill={bar.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
