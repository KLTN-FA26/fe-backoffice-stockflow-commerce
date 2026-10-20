"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  inventoryItemErrorMessage,
  inventoryItemFieldErrors,
  isStaleItemError,
} from "../../errors";
import { inventoryItemKeys } from "../../queries";

import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { InventoryItem } from "../../types";

interface Options<T extends FieldValues> {
  item: InventoryItem;
  form: UseFormReturn<T>;
  context: "logistics" | "policy";
  onDone: () => void;
  /** Item (đã tải lại) → giá trị form; phải ổn định (khai báo ở module) vì nằm trong deps. */
  toValues: (item: InventoryItem) => T;
  /** Ô đang hiển thị — lỗi theo ô ngoài danh sách này đi vào alert của khối. */
  isRendered?: (name: string) => boolean;
}

/**
 * Xử lý kết quả PUT chung cho hai form: thành công → ghi item mới (version mới) vào cache rồi
 * đóng form; version cũ / item biến mất → tải lại item, nạp lại form theo dữ liệu mới (không để
 * giá trị cũ ghi đè người sửa trước) và báo; lỗi theo ô đang hiện → `setError`; còn lại → alert.
 *
 * Version mới về khi form đang mở (refetch nền, vd focus lại cửa sổ): form chưa sửa → nạp lại;
 * đang sửa dở → giữ nguyên giá trị người dùng, bật `outdated` để báo. `baseVersion` là version của
 * dữ liệu form đang hiện — gửi nó khi lưu để BE trả 409 OPTIMISTIC_LOCK thay vì ghi đè lặng lẽ.
 */
export function useItemSubmitHandlers<T extends FieldValues>({
  item,
  form,
  context,
  onDone,
  toValues,
  isRendered = () => true,
}: Options<T>) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const key = inventoryItemKeys.detail(item.id);
  const [baseVersion, setBaseVersion] = useState(item.version);
  // Vừa gặp lỗi version cũ → lần version mới tới thì nạp lại dù form đang sửa dở
  const [reloadOnNext, setReloadOnNext] = useState(false);
  const { isDirty } = form.formState;
  const resetVersion = useRef(item.version);
  const { reset } = form;

  // Điều chỉnh state theo prop ngay lúc render (không setState trong effect)
  if (item.version !== baseVersion && (reloadOnNext || !isDirty)) {
    setBaseVersion(item.version);
    setReloadOnNext(false);
  }

  useEffect(() => {
    if (resetVersion.current === baseVersion) return;
    resetVersion.current = baseVersion;
    reset(toValues(item));
  }, [baseVersion, item, reset, toValues]);

  return {
    error,
    baseVersion,
    outdated: item.version !== baseVersion,
    clearError: () => setError(null),
    onSuccess: (next: InventoryItem) => {
      queryClient.setQueryData(key, next);
      onDone();
    },
    onError: (e: unknown) => {
      if (isStaleItemError(e)) {
        // Version mới đã về trước khi lưu → nạp ngay; chưa về → nạp khi refetch xong
        if (item.version !== baseVersion) setBaseVersion(item.version);
        else setReloadOnNext(true);
        void queryClient.invalidateQueries({ queryKey: key });
        setError(inventoryItemErrorMessage(e, context));
        return;
      }
      const visible = Object.entries(inventoryItemFieldErrors(e, context)).filter(([name]) =>
        isRendered(name),
      );
      for (const [name, message] of visible) {
        form.setError(name as Path<T>, { type: "server", message });
      }
      if (visible.length === 0) setError(inventoryItemErrorMessage(e, context));
    },
  };
}
