"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { PRODUCT_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { statusCell, textCell } from "@/components/shared/column-helpers";
import { Button } from "@/components/ui/button";

import { variantErrorMessage } from "../../variant-errors";
import { VariantFormDialog } from "./VariantFormDialog";
import { VariantPanel } from "./VariantPanel";

import type { UseQueryResult } from "@tanstack/react-query";
import type { Variant } from "../../variant-schemas";

/**
 * Bảng biến thể của sản phẩm (BE `GET /products/{id}/variants`) — thay bảng "SKU" mock cũ,
 * vốn gọi `/skus` không tồn tại ở BE. Bấm một dòng mở panel chi tiết (logistics, ảnh).
 */
export function VariantsSection({
  productId,
  productApproved,
  query,
}: {
  productId: string;
  /** Sản phẩm đã duyệt / đang bán: chỉ khi đó biến thể mới kích hoạt được. */
  productApproved: boolean;
  query: UseQueryResult<Variant[]>;
}) {
  const can = usePermissionChecker();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const variants = query.data ?? [];
  // Đọc lại từ danh sách mới nhất: sau khi đổi trạng thái panel thấy ngay giá trị BE trả.
  const selected = variants.find((v) => v.variantId === selectedId) ?? null;

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
    textCell<Variant>(
      "attributeSignature",
      "Tổ hợp thuộc tính",
      (row) => row.attributeSignature ?? "—",
      {
        color: "secondary",
      },
    ),
    statusCell<Variant>("status", "Trạng thái", (row) => row.status, "sku", {
      sortable: true,
      compare: (a, b) => a.status.localeCompare(b.status),
      withIcon: true,
    }),
  ];

  return (
    <div className="space-y-3">
      {can(PRODUCT_PERMISSIONS.update) && (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" /> Thêm biến thể
          </Button>
        </div>
      )}
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
          data={variants}
          columns={columns}
          rowKey={(row) => row.variantId}
          caption={`${variants.length} biến thể`}
          onRowClick={(row) => setSelectedId(row.variantId)}
          pageSize={10}
        />
      )}
      <VariantPanel
        productId={productId}
        variant={selected}
        productApproved={productApproved}
        open={selected !== null}
        onClose={() => setSelectedId(null)}
      />
      <VariantFormDialog productId={productId} open={adding} onOpenChange={setAdding} />
    </div>
  );
}
