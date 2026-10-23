"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { REPORTING_LABELS } from "@/constants/reporting";

import { formatCompactNumber, formatMoney, formatNumber } from "@/lib/format";

import type { SalesDaily } from "../types";

const L = REPORTING_LABELS;
const TICK = { fill: "var(--ink-tertiary)", fontSize: 11 };

/** dd/MM from yyyy-MM-dd without a Date round-trip (no timezone shift). */
function dayLabel(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Revenue bars (left axis) + orders line (right axis), one point per day. Loaded via next/dynamic. */
export default function SalesDailyChart({ rows }: { rows: readonly SalesDaily[] }) {
  const currency = rows[0]?.currency ?? "VND";
  const data = rows.map((r) => ({ ...r, label: dayLabel(r.day) }));
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid
            stroke="var(--border-default)"
            strokeDasharray="3 3"
            opacity={0.6}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={TICK}
            axisLine={{ stroke: "var(--border-default)" }}
            tickLine={false}
            minTickGap={16}
          />
          <YAxis
            yAxisId="revenue"
            tick={TICK}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => formatCompactNumber(v)}
          />
          <YAxis
            yAxisId="orders"
            orientation="right"
            allowDecimals={false}
            tick={TICK}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            cursor={{ fill: "var(--bg-muted)", opacity: 0.5 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as SalesDaily;
              return (
                <div className="bg-bg-surface border-border-default rounded-[var(--r-sm)] border px-3 py-2 text-xs shadow-md">
                  <p className="text-ink-primary font-medium">
                    {dayLabel(p.day)}/{p.day.slice(0, 4)}
                  </p>
                  <p className="text-ink-secondary mt-0.5 font-mono tabular-nums">
                    {L.revenue}: {formatMoney(p.revenue, p.currency)}
                  </p>
                  <p className="text-ink-secondary font-mono tabular-nums">
                    {L.orders}: {formatNumber(p.ordersCount)}
                  </p>
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            yAxisId="revenue"
            dataKey="revenue"
            name={`${L.revenueAxis} (${currency})`}
            fill="var(--brand)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
          <Line
            yAxisId="orders"
            dataKey="ordersCount"
            name={L.ordersAxis}
            stroke="var(--dot-info)"
            strokeWidth={2}
            dot={false}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
