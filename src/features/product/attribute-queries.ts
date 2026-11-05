import { useQuery } from "@tanstack/react-query";

import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import {
  addAttributeValue,
  createAttribute,
  deleteAttribute,
  deleteAttributeValue,
  listAttributes,
  listCategoryAttributes,
  replaceCategoryAttributes,
  updateAttribute,
  updateAttributeValue,
} from "./attribute-api";
import { isStaleAttributeError } from "./attribute-errors";

import type { AttributePage, ListAttributesParams } from "./attribute-api";

/** Khoá theo từ điển: sửa thuộc tính / giá trị làm mới cả danh sách lẫn các trục đang dùng giá trị đó. */
export const attributeKeys = {
  all: ["attributes"] as const,
  list: (params: ListAttributesParams) => ["attributes", "list", params] as const,
  category: (categoryId: string) => ["attributes", "category", categoryId] as const,
};

export function useAttributes(params: ListAttributesParams = {}, enabled = true) {
  return useQuery({
    queryKey: attributeKeys.list(params),
    queryFn: ({ signal }) => listAttributes(params, signal),
    enabled,
  });
}

/** Thuộc tính đang dùng (kèm giá trị) để chọn trục / mô tả cho sản phẩm. */
export function useActiveAttributes(enabled = true) {
  return useAttributes({ active: true }, enabled);
}

/** Bộ thuộc tính gợi ý của danh mục; `enabled = false` khi chắc chắn thiếu quyền đọc thuộc tính. */
export function useCategoryAttributes(categoryId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: attributeKeys.category(categoryId ?? ""),
    queryFn: ({ signal }) => listCategoryAttributes(categoryId ?? "", signal),
    enabled: Boolean(categoryId) && enabled,
  });
}

/** Trục / mô tả của sản phẩm tham chiếu giá trị từ điển nên đổi từ điển phải làm mới cả `variants`. */
const dictionary = [attributeKeys.all, ["variants"]];

/**
 * Mutation từ điển: thành công hay lỗi dữ liệu cũ (`isStaleAttributeError` — OPTIMISTIC_LOCK, thuộc
 * tính / giá trị đã bị xoá) đều tải lại từ điển + trục đang dùng nó, để câu "Đã tải lại" là thật.
 */
const dictionaryMutation = <TInput, TResult>(
  fn: (input: TInput) => Promise<TResult>,
  successMessage: string,
) =>
  withStaleRefetch(
    createMutation<TInput, TResult>(fn, {
      invalidate: dictionary,
      showErrorToast: false,
      successMessage,
    }),
    dictionary,
    isStaleAttributeError,
  );

export const useCreateAttribute = dictionaryMutation(createAttribute, "Đã tạo thuộc tính");
export const useUpdateAttribute = dictionaryMutation(updateAttribute, "Đã cập nhật thuộc tính");
export const useDeleteAttribute = dictionaryMutation(deleteAttribute, "Đã xoá thuộc tính");
export const useAddAttributeValue = dictionaryMutation(addAttributeValue, "Đã thêm giá trị");
export const useUpdateAttributeValue = dictionaryMutation(
  updateAttributeValue,
  "Đã cập nhật giá trị",
);
export const useDeleteAttributeValue = dictionaryMutation(deleteAttributeValue, "Đã xoá giá trị");

export const useReplaceCategoryAttributes = withStaleRefetch(
  createMutation(replaceCategoryAttributes, {
    invalidate: [attributeKeys.all],
    showErrorToast: false,
    successMessage: "Đã lưu bộ thuộc tính của danh mục",
  }),
  [attributeKeys.all],
  isStaleAttributeError,
);

export type { AttributePage };
