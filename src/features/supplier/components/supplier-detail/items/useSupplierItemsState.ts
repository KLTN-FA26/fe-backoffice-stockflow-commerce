import { useState } from "react";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";

import { PAGE_SIZE, STORAGE_KEYS, SUPPLIER_ITEM_ERROR_MESSAGES } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { ApiError } from "@/lib/api/error";
import {
  supplierItemErrorMessage,
  useDeleteSupplierItem,
  useSupplierItems,
} from "@/features/supplier";

import { toast } from "@/components/shared/Toast";

import type { SupplierItem } from "@/features/supplier/types";

type SortDir = "asc" | "desc";

/**
 * Cột sắp xếp được phía server — BE `SupplierItemController` chỉ nhận
 * `createdAt | lastModifiedAt | currentPrice` (mặc định `createdAt,desc`); bảng chỉ có cột giá.
 */
export const ITEM_SORT_FIELDS = ["currentPrice"] as const;
type ItemSortField = (typeof ITEM_SORT_FIELDS)[number];

export const ITEM_PAGE_SIZE_OPTIONS: number[] = [
  PAGE_SIZE.sm,
  PAGE_SIZE.md,
  PAGE_SIZE.lg,
  PAGE_SIZE.xl,
];

interface ItemsPageConfig {
  pageSize: number;
}

const DEFAULT_CONFIG: ItemsPageConfig = { pageSize: PAGE_SIZE.md };

function mergeConfig(stored: Partial<ItemsPageConfig>, fallback: ItemsPageConfig) {
  return stored.pageSize && ITEM_PAGE_SIZE_OPTIONS.includes(stored.pageSize)
    ? { pageSize: stored.pageSize }
    : fallback;
}

function isSortField(value: string): value is ItemSortField {
  return (ITEM_SORT_FIELDS as readonly string[]).includes(value);
}

function parseSort(raw: string | null): { key: ItemSortField | null; direction: SortDir } {
  const [key = "", dir] = (raw ?? "").split(",");
  return { key: isSortField(key) ? key : null, direction: dir === "desc" ? "desc" : "asc" };
}

const URL_PARSERS = { itemPage: parseAsInteger, itemSort: parseAsString };

export type SupplierItemsEmptyState = "none" | "empty" | "invalid-page";

/**
 * State tab "Danh mục hàng" — trang + sắp xếp trên URL (`itemPage`, `itemSort`, nuqs), số dòng/trang
 * trong localStorage (state-persistence.md). BE không có tham số tìm kiếm cho danh mục NCC nên tab
 * không có ô search / lọc — chỉ sắp xếp và phân trang phía server.
 */
export function useSupplierItemsState(supplierId: string) {
  const [url, setUrl] = useQueryStates(URL_PARSERS);
  const { config, updateConfig } = usePageConfig<ItemsPageConfig>(
    STORAGE_KEYS.adminSupplierItemsConfig,
    DEFAULT_CONFIG,
    mergeConfig,
  );
  const sort = parseSort(url.itemSort);
  const query = useSupplierItems(supplierId, {
    page: Math.max(0, (url.itemPage ?? 1) - 1),
    size: config.pageSize,
    sort: sort.key ? `${sort.key},${sort.direction}` : undefined,
  });

  const data = query.data;
  const emptyState: SupplierItemsEmptyState = !data
    ? "none"
    : data.totalElements === 0
      ? "empty"
      : data.items.length === 0
        ? "invalid-page"
        : "none";

  return {
    query,
    sort,
    pageSize: config.pageSize,
    emptyState,
    /** `page` 0-based như DataTable; URL giữ 1-based, trang đầu = bỏ khỏi URL. */
    changePage: (page: number) => void setUrl({ itemPage: page > 0 ? page + 1 : null }),
    changeSort: (key: string, direction: SortDir) => {
      if (!isSortField(key)) return;
      void setUrl({ itemSort: `${key},${direction}`, itemPage: null });
    },
    changePageSize: (pageSize: number) => {
      updateConfig(() => ({ pageSize }));
      void setUrl({ itemPage: null });
    },
  };
}

export type SupplierItemsState = ReturnType<typeof useSupplierItemsState>;

/**
 * Xoá một dòng danh mục (BE `DELETE …/items/{id}?version=`). Dialog giữ nguyên khi lỗi để hiện câu
 * tiếng Việt (vd 409 `SUPPLIER_ITEM_IN_USE`) — một lần, không toast; version cũ (`OPTIMISTIC_LOCK`)
 * → toast + tải lại rồi đóng.
 */
export function useSupplierItemDeletion(supplierId: string, onConflict: () => void) {
  // `target` giữ dòng cuối cùng sau khi đóng: nội dung hộp xác nhận không đổi trong lúc animation đóng.
  const [target, setTarget] = useState<SupplierItem | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = useDeleteSupplierItem();

  const confirm = () => {
    if (!target || !isOpen) return;
    setError(null);
    remove.mutate(
      { supplierId, item: target },
      {
        onSuccess: () => setIsOpen(false),
        onError: (e) => {
          if (e instanceof ApiError && e.code === "OPTIMISTIC_LOCK") {
            toast.error(SUPPLIER_ITEM_ERROR_MESSAGES.OPTIMISTIC_LOCK);
            onConflict();
            setIsOpen(false);
          } else setError(supplierItemErrorMessage(e));
        },
      },
    );
  };

  return {
    target,
    isOpen,
    error,
    isPending: remove.isPending,
    open: (item: SupplierItem) => {
      setError(null);
      setTarget(item);
      setIsOpen(true);
    },
    close: () => setIsOpen(false),
    confirm,
  };
}

export type SupplierItemDeletion = ReturnType<typeof useSupplierItemDeletion>;
