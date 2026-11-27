"use client";

import { Controller } from "react-hook-form";

import { RichTextEditor } from "@/components/shared/RichTextEditor";

import { uploadDescriptionImage } from "../description-api";
import { ProductTextarea } from "./form-controls";
import { ProductFormField } from "./ProductFormField";

import type { UseFormReturn } from "react-hook-form";
import type { ProductDraftFormValues } from "../schemas";

/**
 * Bước "Mô tả" của form sản phẩm. Mô tả là rich text (Tiptap, ADR-0013); chỉ có tiếng Việt — mô tả tiếng Anh đã bỏ.
 * Ảnh trong mô tả tải lên theo sản phẩm (`description-images`) nên chỉ chèn được khi sửa: lúc tạo mới chưa có
 * sản phẩm để gắn ảnh.
 */
export function ProductDescriptionFields({
  form,
  productId,
}: {
  form: UseFormReturn<ProductDraftFormValues>;
  /** Có khi sửa sản phẩm — bật nút chèn ảnh của ô mô tả. */
  productId?: string;
}) {
  const { register, control } = form;
  // Không qua React Query: ảnh thuộc HTML đang soạn, không có cache nào cần làm mới; ô soạn tự báo lỗi.
  const onUploadImage = productId
    ? async (file: File) => (await uploadDescriptionImage({ productId, file })).url
    : undefined;
  return (
    <section className="border-border-default bg-bg-surface rounded-(--section-radius) border p-4 shadow-(--card-shadow)">
      <h2 className="text-ink-primary text-sm font-semibold">Mô tả</h2>
      <p className="text-ink-secondary mt-1 text-xs">
        Hình ảnh quản lý theo từng biến thể; kích thước, khối lượng theo từng SKU.
        {!productId && " Ảnh trong mô tả chèn được sau khi lưu sản phẩm."}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4">
        <ProductFormField htmlFor="short-description" label="Mô tả ngắn">
          <ProductTextarea {...register("shortDescription")} id="short-description" rows={2} />
        </ProductFormField>
        <ProductFormField htmlFor="description" label="Mô tả">
          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <RichTextEditor
                id="description"
                aria-label="Mô tả"
                value={field.value}
                onChange={field.onChange}
                onUploadImage={onUploadImage}
              />
            )}
          />
        </ProductFormField>
      </div>
    </section>
  );
}
