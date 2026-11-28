"use client";

import { ImageOff, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DetailPanel } from "@/components/shared/DetailPanel";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  useDeleteProductImage,
  useDescribeProductImage,
  useProductImage,
  useUploadProductImage,
} from "../product-image-queries";
import { variantErrorMessage } from "../variant-errors";

import type { ProductImage } from "../product-image-api";

/** BE `FileCategory.PRODUCT_IMAGE_ORIGINAL`: JPEG / PNG / WebP, tối đa 10 MB — như ảnh biến thể. */
const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 10 * 1024 * 1024;
const ALT_MAX = 255;

/** Bản lớn nhất có link xem (BE chỉ ký link ở GET). */
function previewUrl(image: ProductImage): string | null {
  const signed = image.renditions.filter((r) => r.url).sort((a, b) => b.edge - a.edge);
  return signed[0]?.url ?? null;
}

/**
 * Ảnh riêng của sản phẩm (ADR-0012): một ảnh, là ảnh của thẻ sản phẩm trên trang danh sách / danh mục của storefront.
 * Không có bước xuất bản: ảnh lên storefront khi sản phẩm được xuất bản. Chưa có thì thẻ dùng ảnh của biến thể. Sửa
 * được khi sản phẩm nhận thay đổi (`canEdit` — UI-only, BE re-check).
 */
export function ProductImageCard({ productId, canEdit }: { productId: string; canEdit: boolean }) {
  const query = useProductImage(productId);
  const upload = useUploadProductImage();
  const describe = useDescribeProductImage();
  const remove = useDeleteProductImage();
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const image = query.data ?? null;
  const [alt, setAlt] = useState(image?.altText ?? "");
  const [altBase, setAltBase] = useState(image?.altText ?? "");
  const savedAlt = image?.altText ?? "";
  if (savedAlt !== altBase) {
    setAltBase(savedAlt);
    setAlt(savedAlt);
  }
  const fail = (title: string) => (e: unknown) =>
    toast.error(title, variantErrorMessage(e, "upload"));

  const actions = canEdit && (
    <>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label="Chọn ảnh sản phẩm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > MAX_BYTES) {
            toast.error("Ảnh quá lớn", "Ảnh tối đa 10 MB.");
            return;
          }
          upload.mutate({ productId, file }, { onError: fail("Không tải được ảnh") });
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={upload.isPending}
        onClick={() => fileInput.current?.click()}
      >
        <Upload className="size-3.5" aria-hidden />
        {upload.isPending ? "Đang tải lên…" : image ? "Thay ảnh" : "Tải ảnh lên"}
      </Button>
      {image && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-danger gap-1.5"
          onClick={() => setConfirmRemove(true)}
        >
          <Trash2 className="size-3.5" aria-hidden />
          Gỡ ảnh
        </Button>
      )}
    </>
  );

  return (
    <DetailPanel
      title="Ảnh sản phẩm"
      description="Ảnh của thẻ sản phẩm trên danh sách và danh mục storefront. Chưa có thì dùng ảnh của biến thể."
      actions={actions || undefined}
    >
      {query.isLoading ? (
        <p className="text-ink-tertiary text-xs">Đang tải ảnh…</p>
      ) : query.isError ? (
        <p role="alert" className="text-danger text-xs">
          {variantErrorMessage(query.error, "media")}
        </p>
      ) : !image ? (
        <div className="border-border-default text-ink-tertiary flex flex-col items-center gap-1 rounded-[var(--r-sm)] border border-dashed py-6 text-xs">
          <ImageOff className="size-5 opacity-60" aria-hidden />
          Chưa có ảnh sản phẩm
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          <ProductImagePreview image={image} />
          <div className="min-w-0 flex-1 space-y-2 text-xs">
            <p className="text-ink-secondary truncate" title={image.originalName}>
              {image.originalName}
            </p>
            {canEdit ? (
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  describe.mutate(
                    { productId, altText: alt },
                    { onError: fail("Không lưu được chữ thay thế") },
                  );
                }}
              >
                <label htmlFor="product-image-alt" className="text-ink-secondary">
                  Chữ thay thế
                </label>
                <Input
                  id="product-image-alt"
                  value={alt}
                  maxLength={ALT_MAX}
                  onChange={(e) => setAlt(e.target.value)}
                  className="h-8 max-w-sm text-xs"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={alt === savedAlt || describe.isPending}
                >
                  Lưu
                </Button>
              </form>
            ) : (
              <p className="text-ink-secondary">Chữ thay thế: {savedAlt || "—"}</p>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Gỡ ảnh sản phẩm?"
        description="Thẻ sản phẩm trên storefront sẽ dùng lại ảnh của biến thể."
        confirmLabel="Gỡ ảnh"
        loading={remove.isPending}
        onConfirm={() => remove.mutate({ productId }, { onError: fail("Không gỡ được ảnh") })}
      />
    </DetailPanel>
  );
}

function ProductImagePreview({ image }: { image: ProductImage }) {
  const url = previewUrl(image);
  if (!url) {
    return (
      <div className="border-border-default bg-bg-subtle text-ink-tertiary flex size-32 items-center justify-center rounded-[var(--r-sm)] border text-xs">
        Không xem trước được
      </div>
    );
  }
  return (
    // Link xem ngắn hạn của kho ảnh — không qua next/image (không phải domain cố định đã khai báo).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={image.altText || image.originalName}
      className="border-border-default size-32 rounded-[var(--r-sm)] border object-cover"
    />
  );
}
