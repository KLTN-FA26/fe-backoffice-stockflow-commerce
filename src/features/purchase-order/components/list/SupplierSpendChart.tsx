"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatMoney } from "@/lib/format/money";

import type { SupplierSpendRow } from "@/features/purchase-order/api";

function compactVnd(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function SupplierSpendChart({ rows }: { rows: readonly SupplierSpendRow[] }) {
  if (rows.length === 0) return null;
  const data = rows.slice(0, 20).map((r) => ({
    name: r.supplierCode,
    label: r.supplierName,
    value: Number(r.totalSpend),
  }));
  return (
    <div className="bg-bg-surface border-border-default rounded-[var(--r-sm)] border p-3">
      <p className="text-ink-primary mb-2 text-xs font-semibold">
        Xếp hạng chi tiêu (top {data.length})
      </p>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid
              stroke="var(--border-default)"
              strokeDasharray="3 3"
              opacity={0.6}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fill: "var(--ink-tertiary)", fontSize: 11 }}
              axisLine={{ stroke: "var(--border-default)" }}
              tickLine={false}
              interval={0}
              angle={data.length > 8 ? -18 : 0}
              dy={data.length > 8 ? 8 : 0}
              height={data.length > 8 ? 44 : 28}
            />
            <YAxis
              tick={{ fill: "var(--ink-tertiary)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => compactVnd(v)}
              width={56}
            />
            <Tooltip
              cursor={{ fill: "var(--bg-muted)", opacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { name: string; label: string; value: number };
                return (
                  <div className="bg-bg-surface border-border-default rounded-[var(--r-sm)] border px-3 py-2 text-xs shadow-md">
                    <p className="text-ink-primary font-medium">
                      {p.name} — {p.label}
                    </p>
                    <p className="text-ink-secondary mt-0.5 font-mono tabular-nums">
                      {formatMoney(p.value, "VND")}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" fill="var(--brand)" radius={[4, 4, 0, 0]} barSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
