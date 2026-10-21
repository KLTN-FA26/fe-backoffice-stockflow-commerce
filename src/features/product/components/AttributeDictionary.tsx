"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import { FolderTree, Plus, Search, Tags, XCircle } from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { ATTRIBUTE_PERMISSIONS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useUrlTab } from "@/hooks/use-url-filters";
import { usePermissionChecker } from "@/lib/auth";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { ListConfigSummary } from "@/components/shared/ListConfigSummary";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { PageTabPanel, PageTabs } from "@/components/shared/PageTabs";
import {
  CELL,
  codeCell,
  EmptyCell,
  nameCell,
  statusCell,
  textCell,
  viewColumn,
} from "@/components/shared/column-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { attributeErrorMessage } from "../attribute-errors";
import { activeStatus } from "../active-status";
import { DATA_TYPE_LABEL } from "../attribute-labels";
import { ATTRIBUTE_LIST_SIZE } from "../attribute-api";
import { useAttributes } from "../attribute-queries";
import { ATTRIBUTE_DATA_TYPES } from "../attribute-schemas";
import { AttributeDetailPanel } from "./AttributeDetailPanel";
import {
  ATTRIBUTE_ACTIVE_FILTERS,
  ATTRIBUTE_ACTIVE_LABEL,
  AttributeFilterPopover,
} from "./AttributeFilterPopover";
import { AttributeFormDialog } from "./AttributeFormDialog";
import { CategoryAttributesEditor } from "./CategoryAttributesEditor";

import type { Attribute } from "../attribute-schemas";

const TABS = ["attributes", "categories"] as const;

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
  const [active, setActive] = useQueryState(
    "active",
    parseAsStringLiteral(ATTRIBUTE_ACTIVE_FILTERS),
  );
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
    codeCell<Attribute>("code", "Mã", (row) => row.code, {
      sortable: true,
      compare: (a, b) => a.code.localeCompare(b.code),
    }),
    nameCell<Attribute>("name", "Tên", (row) => row.name, {
      sortable: true,
      compare: (a, b) => a.name.localeCompare(b.name),
    }),
    textCell<Attribute>("dataType", "Loại", (row) => DATA_TYPE_LABEL[row.dataType]),
    textCell<Attribute>("unit", "Đơn vị", (row) => row.unit ?? ""),
    {
      key: "values",
      header: "Giá trị",
      align: "right",
      cell: (row) =>
        row.values.length > 0 ? (
          <span className={CELL.number}>{row.values.length}</span>
        ) : (
          <EmptyCell />
        ),
    },
    statusCell<Attribute>("active", "Trạng thái", (row) => activeStatus(row.active), "product"),
    viewColumn<Attribute>((row) => ({
      label: `Xem ${row.code}`,
      onOpen: () => setSelectedId(row.attributeId),
    })),
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
            <div className="border-border-default bg-bg-surface mb-3 flex flex-wrap items-center gap-2 rounded-[var(--r-sm)] border px-3 py-2 shadow-[var(--card-shadow)]">
              <div className="relative min-w-[280px] flex-1 lg:max-w-xl">
                <Search className="text-accent pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  aria-label="Tìm thuộc tính"
                  placeholder="Tìm theo mã hoặc tên…"
                  value={q}
                  onChange={(e) => void setQ(e.target.value || null)}
                  className={cn(FORM_INPUT_CLASS, "pl-9")}
                />
              </div>
              <AttributeFilterPopover
                dataType={dataType}
                active={active}
                onDataTypeChange={(v) => void setDataType(v)}
                onActiveChange={(v) => void setActive(v)}
              />
            </div>
            <ListConfigSummary
              items={[
                {
                  label: "Search chính",
                  value: q || "Chưa nhập",
                  active: q !== "",
                  onClear: () => void setQ(null),
                  clearLabel: "Xoá search chính",
                },
                {
                  label: "Loại",
                  value: dataType ? DATA_TYPE_LABEL[dataType] : "Tất cả",
                  active: dataType !== null,
                  onClear: () => void setDataType(null),
                  clearLabel: "Xoá lọc loại",
                },
                {
                  label: "Trạng thái",
                  value: active ? ATTRIBUTE_ACTIVE_LABEL[active] : "Tất cả",
                  active: active !== null,
                  onClear: () => void setActive(null),
                  clearLabel: "Xoá lọc trạng thái",
                },
              ]}
              onResetAll={() => {
                void setQ(null);
                void setDataType(null);
                void setActive(null);
              }}
              resetDisabled={!q && !dataType && !active}
            />

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
