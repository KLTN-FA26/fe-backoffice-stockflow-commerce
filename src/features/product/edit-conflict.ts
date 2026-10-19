/**
 * Form sửa sản phẩm bị 409 OPTIMISTIC_LOCK (BE `Product.requireVersion`): response lỗi không kèm
 * `version` mới nên FE tải lại sản phẩm rồi so ba bản — PURE, không side effect.
 */
import { UI_LABELS } from "@/constants";

import { productToDraftForm } from "./create-product-form";

import type { ProductDraftFormValues } from "./schemas";
import type { Product } from "./types";

type EditableField = keyof typeof UI_LABELS.product.edit.fields;

const FIELDS = Object.keys(UI_LABELS.product.edit.fields) as EditableField[];

/**
 * Ô người khác vừa đổi mà lần lưu tới sẽ ghi đè: giá trị trên server đã khác bản form dựa vào
 * (`base`) VÀ khác nội dung người dùng đang nhập. Ô server đổi trùng đúng giá trị người dùng nhập thì
 * không xung đột nên không nêu. Thiếu `base` → so thẳng bản mới với nội dung đang nhập.
 */
export function conflictingFields(
  base: Product | undefined,
  latest: Product,
  input: ProductDraftFormValues,
): string[] {
  const before = base ? productToDraftForm(base) : undefined;
  const after = productToDraftForm(latest);
  return FIELDS.filter(
    (field) => (!before || before[field] !== after[field]) && after[field] !== input[field],
  ).map((field) => UI_LABELS.product.edit.fields[field]);
}
