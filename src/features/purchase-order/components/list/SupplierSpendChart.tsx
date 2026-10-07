"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCompactNumber, formatMoney } from "@/lib/format";

import type { SupplierSpendRow } from "@/features/purchase-order";

/**
 * Biểu đồ xếp hạng chi tiêu — chỉ MỘT tiền tệ (`currency`): so cột VND với cột USD không có
 * nghĩa (BE #40 tách báo cáo theo tiền tệ). Vẽ đúng các dòng của trang đang xem (BE phân trang,
 * không giới hạn số NCC) nên đi cùng phân trang của bảng; `rankStart` = hạng của dòng đầu.
 * Load qua `next/dynamic` (SupplierSpendSection).
 */
export default function SupplierSpendChart({
  rows,
  currency,
  rankStart,
  total,
}: {
  rows: readonly SupplierSpendRow[];
  currency: string;
  rankStart: number;
  total: number;
}) {
  if (rows.length === 0) return null;
  const data = rows.map((r) => ({
    name: r.supplierCode,
    label: r.supplierName,
    value: Number(r.totalSpend),
  }));
  return (
    <div className="bg-bg-surface border-border-default rounded-[var(--r-sm)] border p-3">
      <p className="text-ink-primary mb-2 text-xs font-semibold">
        Xếp hạng chi tiêu theo {currency} — hạng {rankStart}–{rankStart + data.length - 1} / {total}
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
              tickFormatter={(v: number) => formatCompactNumber(v)}
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
                      {formatMoney(p.value, currency)}
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
