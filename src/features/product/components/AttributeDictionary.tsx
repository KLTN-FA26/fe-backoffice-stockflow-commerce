"use client";

import { useMemo, useState } from "react";
import { Tags, XCircle } from "lucide-react";

import { ATTRIBUTE_PERMISSIONS } from "@/constants";
import { useUrlTab } from "@/hooks/use-url-filters";
import { usePermissionChecker } from "@/lib/auth";
import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { HeaderActions, HeaderCreateButton } from "@/components/shared/HeaderActions";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { PageTabPanel, PageTabs } from "@/components/shared/PageTabs";
import { Button } from "@/components/ui/button";

import { attributeErrorMessage } from "../attribute-errors";
import { ATTRIBUTE_LIST_SIZE } from "../attribute-api";
import { useAttributes } from "../attribute-queries";
import {
  ATTRIBUTE_COLUMNS,
  attributeColumns,
  attributeHeaderFilters,
  matchesAttributeColumns,
  type AttributeColumnKey,
} from "./attribute-columns";
import { AttributeDetailPanel } from "./AttributeDetailPanel";
import { AttributeFormDialog } from "./AttributeFormDialog";
import { AttributeListToolbar } from "./AttributeListToolbar";
import { CategoryAttributesEditor } from "./CategoryAttributesEditor";
import { useAttributeListState } from "./useAttributeListState";

const TABS = ["attributes", "categories"] as const;
/** EmptyState nằm trong thân bảng: bỏ khung (rule A7). */
const TABLE_EMPTY_CLASS = "rounded-none border-0 bg-transparent py-10 whitespace-normal";

/**
 * Từ điển thuộc tính (BE PR #113, WBS 3.1.2): danh sách thuộc tính kèm giá trị, tạo / sửa / xoá, và
 * bộ thuộc tính gợi ý theo danh mục. Màn này chưa có màn danh mục riêng nên bộ thuộc tính danh mục
 * nằm ở tab thứ hai. Bộ lọc nằm trên URL (F5 giữ nguyên); BE lọc theo `q`, `dataType`, `active`.
 */
export function AttributeDictionary() {
  const can = usePermissionChecker();
  const [tab, setTab] = useUrlTab("tab", TABS, "attributes");
  const list = useAttributeListState();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<AttributeColumnKey[]>([
    ...ATTRIBUTE_COLUMNS,
  ]);

  const query = useAttributes(list.params, tab === "attributes");
  const all = useMemo(() => query.data?.items ?? [], [query.data]);
  const { code, name } = list.columnSearch;
  const rows = useMemo(
    () => all.filter((a) => matchesAttributeColumns(a, { code, name })),
    [all, code, name],
  );
  // Đọc lại từ danh sách mới nhất (cả dòng bị lọc cột ẩn): sau khi sửa, panel thấy ngay giá trị BE trả.
  const selected = all.find((a) => a.attributeId === selectedId) ?? null;
  const columns = withHeaderFilters(
    attributeColumns((row) => setSelectedId(row.attributeId)).filter((column) =>
      visibleColumns.includes(column.key),
    ),
    attributeHeaderFilters(list),
  );

  return (
    // Giao diện kiểu Vercel như trang danh sách sản phẩm (globals.css `.surface-soft`)
    <div className="surface-soft">
      <h1 className="sr-only">Từ điển thuộc tính</h1>
      <PageTabs
        tabs={[
          { value: "attributes", label: "Thuộc tính" },
          { value: "categories", label: "Theo danh mục" },
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
            {/* Nút chính của tab nằm trên thanh breadcrumb (kiểu Vercel) */}
            {can(ATTRIBUTE_PERMISSIONS.create) && (
              <HeaderActions>
                <HeaderCreateButton
                  onClick={() => setCreating(true)}
                  aria-label="Tạo mới thuộc tính"
                  tooltip="Tạo thuộc tính"
                />
              </HeaderActions>
            )}
            <AttributeListToolbar
              state={list}
              columns={visibleColumns}
              onColumnsChange={setVisibleColumns}
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
            ) : (
              <>
                {/* Bảng luôn giữ header; không có dữ liệu / không khớp lọc thì báo trong thân bảng */}
                <DataTable
                  stickyHeader
                  data={rows}
                  columns={columns}
                  rowKey={(row) => row.attributeId}
                  caption={`${rows.length} thuộc tính`}
                  onRowClick={(row) => setSelectedId(row.attributeId)}
                  pageSize={15}
                  emptyState={
                    <EmptyState
                      className={TABLE_EMPTY_CLASS}
                      icon={<Tags className="size-8" />}
                      title={list.filtered ? "Không tìm thấy kết quả" : "Chưa có thuộc tính nào"}
                      description={
                        list.filtered
                          ? "Có thể có thuộc tính, nhưng bộ lọc hiện tại không khớp."
                          : "Thêm thuộc tính đầu tiên (vd Màu sắc, Kích cỡ) để dùng làm trục biến thể."
                      }
                      action={
                        list.filtered ? (
                          <Button type="button" variant="outline" size="sm" onClick={list.resetAll}>
                            Bỏ bộ lọc
                          </Button>
                        ) : undefined
                      }
                    />
                  }
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
    </div>
  );
}
