"use client";

import { useState } from "react";

import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { statusCell, textCell } from "@/components/shared/column-helpers";
import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";

import { variantErrorMessage } from "../../variant-errors";

import { GenerateVariantsDialog } from "../GenerateVariantsDialog";
import { VariantFormDialog } from "./VariantFormDialog";
import { useVariantTableFilters, variantOptionText } from "./variant-table-filters";
import { VariantPanel } from "./VariantPanel";

import type { UseQueryResult } from "@tanstack/react-query";
import type { Variant } from "../../variant-schemas";
import type { VariantDialog } from "./VariantsActions";

/**
 * Bảng biến thể của sản phẩm (BE `GET /products/{id}/variants`) — thay bảng "SKU" mock cũ,
 * vốn gọi `/skus` không tồn tại ở BE. Bấm một dòng mở panel chi tiết (logistics & quy cách thùng,
 * ảnh, cấu hình in). Danh sách gồm cả SKU riêng của khách (`isCustomerOwnedSku`). Nút thêm / sinh biến thể nằm trên dòng tiêu đề mục (`VariantsActions`); mục giữ `dialog`.
 */
export function VariantsSection({
  productId,
  productCode,
  productApproved,
  acceptsChanges,
  customizable,
  query,
  dialog,
  onDialogChange,
}: {
  productId: string;
  /** Mã sản phẩm — gốc của SKU sinh tự động (`MÃ-GIÁ_TRỊ-…`). */
  productCode: string;
  /** Sản phẩm đã duyệt / đang bán: chỉ khi đó biến thể mới kích hoạt được. */
  productApproved: boolean;
  /** Không chờ duyệt, không ngừng kinh doanh (BE `Product.acceptsChanges`): mới thêm / sinh được biến thể. */
  acceptsChanges: boolean;
  /** Sản phẩm tuỳ chỉnh / in ấn — panel biến thể hiện link tới cấu hình in. */
  customizable: boolean;
  query: UseQueryResult<Variant[]>;
  dialog: VariantDialog;
  onDialogChange: (dialog: VariantDialog) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const variants = query.data ?? [];
  // Đọc lại từ danh sách mới nhất: sau khi đổi trạng thái panel thấy ngay giá trị BE trả.
  const selected = variants.find((v) => v.variantId === selectedId) ?? null;
  const { rows, filters, filtering } = useVariantTableFilters(variants);

  const columns: ColumnDef<Variant>[] = [
    textCell<Variant>("sku", "Mã SKU", (row) => row.sku, {
      sortable: true,
      compare: (a, b) => a.sku.localeCompare(b.sku),
      color: "primary",
    }),
    textCell<Variant>(
      "name",
      "Tên biến thể",
      (row) => (row.defaultVariant ? `${row.name} · mặc định` : row.name),
      {
        sortable: true,
        compare: (a, b) => a.name.localeCompare(b.name),
      },
    ),
    // SKU riêng của khách không mang tuỳ chọn trục (BE sinh không kèm option) — nêu rõ thay vì "—"
    textCell<Variant>("options", "Tuỳ chọn", variantOptionText, { color: "secondary" }),
    statusCell<Variant>("status", "Trạng thái", (row) => row.status, "sku", {
      sortable: true,
      compare: (a, b) => a.status.localeCompare(b.status),
      withIcon: true,
    }),
  ];

  return (
    <div className="space-y-3">
      {query.isError ? (
        <p role="alert" className="text-danger text-[0.8125rem]">
          {variantErrorMessage(query.error, "load")}
        </p>
      ) : query.isLoading ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Đang tải biến thể…</p>
      ) : variants.length === 0 ? (
        <div className="border-border-default text-ink-tertiary rounded-[var(--r-sm)] border py-10 text-center text-[0.8125rem]">
          Chưa có biến thể nào
        </div>
      ) : (
        <DataTable
          data={rows}
          columns={withHeaderFilters(columns, filters)}
          rowKey={(row) => row.variantId}
          caption={
            filtering
              ? `${rows.length} / ${variants.length} biến thể`
              : `${variants.length} biến thể`
          }
          onRowClick={(row) => setSelectedId(row.variantId)}
          pageSize={10}
          emptyState={filtering ? "Không có biến thể nào khớp bộ lọc." : undefined}
        />
      )}
      <VariantPanel
        productId={productId}
        variant={selected}
        productApproved={productApproved}
        acceptsChanges={acceptsChanges}
        customizable={customizable}
        open={selected !== null}
        onClose={() => setSelectedId(null)}
      />
      <VariantFormDialog
        productId={productId}
        open={dialog === "add"}
        onOpenChange={(open) => onDialogChange(open ? "add" : null)}
      />
      <GenerateVariantsDialog
        productId={productId}
        productCode={productCode}
        open={dialog === "generate"}
        onOpenChange={(open) => onDialogChange(open ? "generate" : null)}
      />
    </div>
  );
}
