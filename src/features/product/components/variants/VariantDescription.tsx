"use client";

import { useState } from "react";

import { RichTextEditor } from "@/components/shared/RichTextEditor";
import { RichTextView } from "@/components/shared/RichTextView";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { uploadDescriptionImage } from "../../description-api";
import { useSetVariantDescription } from "../../description-queries";
import { variantErrorMessage } from "../../variant-errors";

import type { Variant } from "../../variant-schemas";

/**
 * Mô tả riêng của biến thể (ADR-0013): storefront hiện mô tả này khi khách chọn biến thể; chưa có thì dùng mô tả của
 * sản phẩm. Soạn bằng Tiptap, chèn ảnh qua `description-images`; BE lọc HTML trước khi lưu. Sửa được ở mọi trạng thái
 * biến thể khi sản phẩm nhận thay đổi (`canEdit` — UI-only, BE re-check).
 */
export function VariantDescription({
  productId,
  variant,
  canEdit,
}: {
  productId: string;
  variant: Variant;
  canEdit: boolean;
}) {
  const saved = variant.description ?? "";
  const [draft, setDraft] = useState(saved);
  // Biến thể vừa được tải lại (lưu xong / người khác sửa) → nạp lại bản đã lưu nếu người dùng chưa sửa gì.
  const [base, setBase] = useState(saved);
  if (saved !== base) {
    setBase(saved);
    if (draft === base) setDraft(saved);
  }
  const save = useSetVariantDescription();
  const dirty = draft !== saved;

  if (!canEdit) {
    return (
      <RichTextView
        html={saved}
        empty="Chưa có mô tả riêng — storefront dùng mô tả của sản phẩm."
      />
    );
  }
  return (
    <div className="space-y-2">
      <RichTextEditor
        id={`variant-description-${variant.variantId}`}
        aria-label="Mô tả biến thể"
        value={draft}
        onChange={setDraft}
        disabled={save.isPending}
        onUploadImage={async (file) => (await uploadDescriptionImage({ productId, file })).url}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-ink-tertiary text-xs">
          {saved
            ? "Storefront hiện mô tả này khi chọn biến thể."
            : "Để trống thì storefront dùng mô tả của sản phẩm."}
        </p>
        <div className="flex shrink-0 gap-2">
          {dirty && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={save.isPending}
              onClick={() => setDraft(saved)}
            >
              Huỷ
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={!dirty || save.isPending}
            onClick={() =>
              save.mutate(
                { productId, variantId: variant.variantId, html: draft },
                {
                  onError: (e) =>
                    toast.error("Không lưu được mô tả", variantErrorMessage(e, "save")),
                },
              )
            }
          >
            {save.isPending ? "Đang lưu…" : "Lưu mô tả"}
          </Button>
        </div>
      </div>
    </div>
  );
}
