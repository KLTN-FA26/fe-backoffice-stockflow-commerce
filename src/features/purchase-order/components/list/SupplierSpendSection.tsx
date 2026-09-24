"use client";

import { useMemo, useState } from "react";

import { PAGE_SIZE } from "@/constants";
import { formatMoney } from "@/lib/format/money";
import { Card } from "@/components/shared/Card";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useSupplierSpend } from "@/features/purchase-order";

import { SupplierSpendChart } from "./SupplierSpendChart";

export function SupplierSpendSection() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE.md);
  const spendQ = useSupplierSpend({
    page,
    pageSize,
    expectedAtFrom: applied.from || undefined,
    expectedAtTo: applied.to || undefined,
  });
  // Single query — chart derived from same data (top 20 of current page). Avoids double aggregation on BE.
  const chartRows = useMemo(() => (spendQ.data?.items ?? []).slice(0, 20), [spendQ.data]);
  const items = spendQ.data?.items ?? [];
  const total = spendQ.data?.total ?? 0;
  const loading = spendQ.isLoading;

  const apply = () => {
    setApplied({ from, to });
    setPage(1);
  };
  const clear = () => {
    setFrom("");
    setTo("");
    setApplied({ from: "", to: "" });
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-ink-primary text-sm font-semibold">Chi tiêu theo nhà cung cấp</h3>
            <p className="text-ink-secondary mt-1 text-xs">
              Tổng tiền (loại DRAFT/CANCELLED) — xếp giảm dần. Lọc theo ngày giao dự kiến.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="spend-from" className="text-ink-secondary text-xs">
                Từ ngày (expectedAt)
              </Label>
              <Input
                id="spend-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="bg-bg-surface h-8 w-[160px] rounded-[var(--r-sm)] text-[0.8125rem]"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="spend-to" className="text-ink-secondary text-xs">
                Đến ngày
              </Label>
              <Input
                id="spend-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="bg-bg-surface h-8 w-[160px] rounded-[var(--r-sm)] text-[0.8125rem]"
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={apply}
              className="bg-brand text-ink-inverse hover:bg-brand-hover h-8 rounded-[var(--r-sm)]"
            >
              Lọc
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clear}
              className="border-border-default bg-bg-surface h-8 rounded-[var(--r-sm)]"
            >
              Xoá lọc
            </Button>
          </div>
        </div>
      </Card>

      {spendQ.isLoading ? (
        <div className="bg-bg-surface border-border-default text-ink-tertiary rounded-[var(--r-sm)] border p-8 text-center text-sm">
          Đang tải biểu đồ...
        </div>
      ) : chartRows.length > 0 ? (
        <SupplierSpendChart rows={chartRows} />
      ) : null}

      <div>
        {loading ? (
          <div className="bg-bg-surface border-border-default text-ink-tertiary rounded-[var(--r-sm)] border py-8 text-center text-sm">
            Đang tải...
          </div>
        ) : (
          <DataTable
            data={items as never}
            columns={
              [
                {
                  key: "supplierCode",
                  header: "Mã NCC",
                  cell: (r: { supplierCode: string }) => (
                    <span className="font-mono text-[0.8125rem] tabular-nums">
                      {r.supplierCode}
                    </span>
                  ),
                },
                {
                  key: "supplierName",
                  header: "Nhà cung cấp",
                  cell: (r: { supplierName: string }) => r.supplierName,
                },
                {
                  key: "totalSpend",
                  header: "Tổng chi",
                  align: "right",
                  cell: (r: { totalSpend: number | string }) => (
                    <span className="tabular-nums">{formatMoney(Number(r.totalSpend), "VND")}</span>
                  ),
                },
                {
                  key: "purchaseOrderCount",
                  header: "Số PO",
                  align: "right",
                  cell: (r: { purchaseOrderCount: number }) => (
                    <span className="tabular-nums">{r.purchaseOrderCount}</span>
                  ),
                },
              ] as never
            }
            rowKey={(r: { supplierId: string }) => r.supplierId}
            pageSize={pageSize}
            total={total}
            page={page}
            onPageChange={setPage}
            onPageSizeChange={(v: number) => setPageSize(v)}
          />
        )}
        {!loading && spendQ.isError && (
          <p className="text-status-danger mt-2 text-sm">Không tải được báo cáo chi tiêu.</p>
        )}
      </div>
    </div>
  );
}
