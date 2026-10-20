"use client";

import { useMemo, useState } from "react";
import { FolderTree, Plus, Search, Tags, XCircle } from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { ATTRIBUTE_PERMISSIONS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useUrlTab } from "@/hooks/use-url-filters";
import { usePermissionChecker } from "@/lib/auth";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { PageTabPanel, PageTabs } from "@/components/shared/PageTabs";
import { textCell } from "@/components/shared/column-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { attributeErrorMessage } from "../attribute-errors";
import { DATA_TYPE_LABEL } from "../attribute-labels";
import { ATTRIBUTE_LIST_SIZE } from "../attribute-api";
import { useAttributes } from "../attribute-queries";
import { ATTRIBUTE_DATA_TYPES } from "../attribute-schemas";
import { AttributeDetailPanel } from "./AttributeDetailPanel";
import { AttributeFormDialog } from "./AttributeFormDialog";
import { CategoryAttributesEditor } from "./CategoryAttributesEditor";

import type { Attribute } from "../attribute-schemas";

const TABS = ["attributes", "categories"] as const;
const ACTIVE_FILTERS = ["true", "false"] as const;

/**
 * Từ điển thuộc tính (BE PR #113, WBS 3.1.2): danh sách thuộc tính kèm giá trị, tạo / sửa / xoá, và
 * bộ thuộc tính gợi ý theo danh mục. Màn này chưa có màn danh mục riêng nên bộ thuộc tính danh mục
 * nằm ở tab thứ hai. Bộ lọc nằm trên URL (F5 giữ nguyên); BE lọc theo `q`, `dataType`, `active`.
 */
export function AttributeDictionary() {
  const can = usePermissionChecker();
  const [tab, setTab] = useUrlTab("tab", TABS, "attributes");
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [dataType, setDataType] = useQueryState(
    "dataType",
    parseAsStringLiteral(ATTRIBUTE_DATA_TYPES),
  );
  const [active, setActive] = useQueryState("active", parseAsStringLiteral(ACTIVE_FILTERS));
  const debouncedQ = useDebouncedValue(q, 300);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      q: debouncedQ.trim() || undefined,
      dataType: dataType ?? undefined,
      active: active === null ? undefined : active === "true",
    }),
    [debouncedQ, dataType, active],
  );
  const query = useAttributes(params, tab === "attributes");
  const rows = query.data?.items ?? [];
  // Đọc lại từ danh sách mới nhất: sau khi sửa, panel thấy ngay giá trị BE trả.
  const selected = rows.find((a) => a.attributeId === selectedId) ?? null;
  const filtered = Boolean(debouncedQ.trim() || dataType || active);

  const columns: ColumnDef<Attribute>[] = [
    {
      key: "code",
      header: "Mã",
      sortable: true,
      compare: (a, b) => a.code.localeCompare(b.code),
      cell: (row) => (
        <span className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium">
          {row.code}
        </span>
      ),
    },
    textCell<Attribute>("name", "Tên", (row) => row.name, {
      sortable: true,
      compare: (a, b) => a.name.localeCompare(b.name),
      color: "primary",
    }),
    textCell<Attribute>("dataType", "Loại", (row) => DATA_TYPE_LABEL[row.dataType]),
    textCell<Attribute>("unit", "Đơn vị", (row) => row.unit || "—"),
    textCell<Attribute>("values", "Giá trị", (row) =>
      row.values.length > 0 ? String(row.values.length) : "—",
    ),
    textCell<Attribute>("active", "Trạng thái", (row) => (row.active ? "Đang dùng" : "Ngừng dùng")),
  ];

  return (
    <>
      <PageHeader
        title="Từ điển thuộc tính"
        subtitle="Thuộc tính dùng làm trục biến thể (màu, cỡ…) hoặc mô tả sản phẩm, và bộ thuộc tính gợi ý theo danh mục."
        actions={
          tab === "attributes" && can(ATTRIBUTE_PERMISSIONS.create) ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setCreating(true)}
              className="bg-brand !text-ink-inverse hover:bg-brand-hover rounded-[var(--r-sm)]"
            >
              <Plus className="size-3.5" /> Thêm thuộc tính
            </Button>
          ) : undefined
        }
      />
      {/* Thanh tab dùng chung (kiểu Tabs shadcn) — đồng bộ với PO, Thương hiệu & danh mục */}
      <PageTabs
        tabs={[
          { value: "attributes", label: "Thuộc tính", icon: Tags },
          { value: "categories", label: "Theo danh mục", icon: FolderTree },
        ]}
        value={tab}
        onChange={(next) => void setTab(next)}
        idPrefix="attribute-dictionary"
        ariaLabel="Từ điển thuộc tính"
      />

      <PageTabPanel idPrefix="attribute-dictionary" value={tab}>
        {tab === "categories" ? (
          <CategoryAttributesEditor />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="text-ink-tertiary absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                <Input
                  aria-label="Tìm thuộc tính"
                  placeholder="Tìm theo mã hoặc tên…"
                  value={q}
                  onChange={(e) => void setQ(e.target.value || null)}
                  className="w-64 pl-8"
                />
              </div>
              <Select
                value={dataType ?? "all"}
                onValueChange={(v) =>
                  void setDataType(
                    v === "all" ? null : (v as (typeof ATTRIBUTE_DATA_TYPES)[number]),
                  )
                }
              >
                <SelectTrigger aria-label="Lọc theo loại" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mọi loại</SelectItem>
                  {ATTRIBUTE_DATA_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {DATA_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={active ?? "all"}
                onValueChange={(v) =>
                  void setActive(v === "all" ? null : (v as (typeof ACTIVE_FILTERS)[number]))
                }
              >
                <SelectTrigger aria-label="Lọc theo trạng thái" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mọi trạng thái</SelectItem>
                  <SelectItem value="true">Đang dùng</SelectItem>
                  <SelectItem value="false">Ngừng dùng</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {query.isLoading ? (
              <PageSkeleton variant="list" />
            ) : query.isError ? (
              <EmptyState
                icon={<XCircle className="size-8" />}
                title="Không tải được từ điển thuộc tính"
                description={attributeErrorMessage(query.error, "load")}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void query.refetch()}
                  >
                    Thử lại
                  </Button>
                }
              />
            ) : rows.length === 0 ? (
              <EmptyState
                title={filtered ? "Không tìm thấy kết quả" : "Chưa có thuộc tính nào"}
                description={
                  filtered
                    ? "Có thể có thuộc tính, nhưng bộ lọc hiện tại không khớp."
                    : "Thêm thuộc tính đầu tiên (vd Màu sắc, Kích cỡ) để dùng làm trục biến thể."
                }
                action={
                  filtered ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void setQ(null);
                        void setDataType(null);
                        void setActive(null);
                      }}
                    >
                      Bỏ bộ lọc
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <DataTable
                  data={rows}
                  columns={columns}
                  rowKey={(row) => row.attributeId}
                  caption={`${rows.length} thuộc tính`}
                  onRowClick={(row) => setSelectedId(row.attributeId)}
                  pageSize={15}
                />
                {(query.data?.totalElements ?? 0) > ATTRIBUTE_LIST_SIZE && (
                  <p className="text-ink-tertiary mt-2 text-xs">
                    Chỉ hiện {ATTRIBUTE_LIST_SIZE} thuộc tính đầu — thu hẹp bằng bộ lọc để xem phần
                    còn lại.
                  </p>
                )}
              </>
            )}
            <AttributeDetailPanel attribute={selected} onClose={() => setSelectedId(null)} />
            <AttributeFormDialog
              open={creating}
              onOpenChange={setCreating}
              onSaved={(a) => setSelectedId(a.attributeId)}
            />
          </>
        )}
      </PageTabPanel>
    </>
  );
}
