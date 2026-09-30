"use client";

import { useState } from "react";

import { PAGE_SIZE } from "@/constants";
import { Card } from "@/components/shared/Card";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useSupplierSpend } from "@/features/purchase-order";

import { SupplierSpendChart } from "./SupplierSpendChart";
import { SPEND_COLUMNS } from "./supplierSpendColumns";

const DATE_INPUT_CLASS = "bg-bg-surface h-8 w-[160px] rounded-[var(--r-sm)] text-[0.8125rem]";

export function SupplierSpendSection() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE.md);
  const spendQ = useSupplierSpend({
    page,
    pageSize,
    expectedAtFrom: applied.from || undefined,
    expectedAtTo: applied.to || undefined,
  });
  // One query feeds both chart and table (chart = top 20 of the current page).
  const items = spendQ.data?.items ?? [];

  const applyRange = (range: { from: string; to: string }) => {
    setApplied(range);
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
                className={DATE_INPUT_CLASS}
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
                className={DATE_INPUT_CLASS}
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => applyRange({ from, to })}
              className="bg-brand text-ink-inverse hover:bg-brand-hover h-8 rounded-[var(--r-sm)]"
            >
              Lọc
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFrom("");
                setTo("");
                applyRange({ from: "", to: "" });
              }}
              className="border-border-default bg-bg-surface h-8 rounded-[var(--r-sm)]"
            >
              Xoá lọc
            </Button>
          </div>
        </div>
      </Card>

      {spendQ.isLoading ? (
        <div className="bg-bg-surface border-border-default text-ink-tertiary rounded-[var(--r-sm)] border py-8 text-center text-sm">
          Đang tải...
        </div>
      ) : (
        <>
          <SupplierSpendChart rows={items.slice(0, 20)} />
          <DataTable
            data={items}
            columns={SPEND_COLUMNS}
            rowKey={(r) => r.supplierId}
            pageSize={pageSize}
            total={spendQ.data?.total ?? 0}
            page={page}
            onPageChange={setPage}
            onPageSizeChange={(v) => {
              setPageSize(v);
              setPage(1); // data-table-mode-a §5: new page size → back to page 1
            }}
          />
        </>
      )}
      {spendQ.isError && (
        <p role="alert" className="text-danger text-sm">
          Không tải được báo cáo chi tiêu.
        </p>
      )}
    </div>
  );
}
