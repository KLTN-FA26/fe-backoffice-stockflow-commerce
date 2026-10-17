import { useQuery } from "@tanstack/react-query";

import { createMutation } from "@/lib/api/query-factory";

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

import type { AttributePage, ListAttributesParams } from "./attribute-api";
import type {
  Attribute,
  AttributeFormValues,
  AttributeValueFormValues,
  CategoryAttribute,
  CategoryAttributeEntry,
} from "./attribute-schemas";

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

export function useCategoryAttributes(categoryId: string | undefined) {
  return useQuery({
    queryKey: attributeKeys.category(categoryId ?? ""),
    queryFn: ({ signal }) => listCategoryAttributes(categoryId ?? "", signal),
    enabled: Boolean(categoryId),
  });
}

/** Trục / mô tả của sản phẩm tham chiếu giá trị từ điển nên đổi từ điển phải làm mới cả `variants`. */
const dictionary = [attributeKeys.all, ["variants"]];

export const useCreateAttribute = createMutation<AttributeFormValues, Attribute>(createAttribute, {
  invalidate: dictionary,
  showErrorToast: false,
  successMessage: "Đã tạo thuộc tính",
});

export const useUpdateAttribute = createMutation<
  { attributeId: string; version: number; values: AttributeFormValues },
  Attribute
>(updateAttribute, {
  invalidate: dictionary,
  showErrorToast: false,
  successMessage: "Đã cập nhật thuộc tính",
});

export const useDeleteAttribute = createMutation<{ attributeId: string; version: number }, void>(
  deleteAttribute,
  { invalidate: dictionary, showErrorToast: false, successMessage: "Đã xoá thuộc tính" },
);

export const useAddAttributeValue = createMutation<
  { attributeId: string; values: AttributeValueFormValues },
  Attribute
>(addAttributeValue, {
  invalidate: dictionary,
  showErrorToast: false,
  successMessage: "Đã thêm giá trị",
});

export const useUpdateAttributeValue = createMutation<
  { attributeId: string; valueId: string; version: number; values: AttributeValueFormValues },
  Attribute
>(updateAttributeValue, {
  invalidate: dictionary,
  showErrorToast: false,
  successMessage: "Đã cập nhật giá trị",
});

export const useDeleteAttributeValue = createMutation<
  { attributeId: string; valueId: string; version: number },
  Attribute
>(deleteAttributeValue, {
  invalidate: dictionary,
  showErrorToast: false,
  successMessage: "Đã xoá giá trị",
});

export const useReplaceCategoryAttributes = createMutation<
  { categoryId: string; attributes: CategoryAttributeEntry[] },
  CategoryAttribute[]
>(replaceCategoryAttributes, {
  invalidate: [attributeKeys.all],
  showErrorToast: false,
  successMessage: "Đã lưu bộ thuộc tính của danh mục",
});

export type { AttributePage };
