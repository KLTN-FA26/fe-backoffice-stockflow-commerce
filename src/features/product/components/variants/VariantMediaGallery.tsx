"use client";

import { useRef, useState } from "react";
import { ImageOff, Star, Trash2, Upload } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { variantErrorMessage } from "../../variant-errors";
import {
  useDeleteVariantMedia,
  useMakePrimaryMedia,
  useMediaViewUrl,
  usePublishVariantMedia,
  useUploadVariantMedia,
  useVariantMedia,
  useWithdrawVariantMedia,
} from "../../variant-queries";
import { PUBLISH_MEDIA_MAX } from "../../variant-schemas";

import type { VariantMedia } from "../../variant-schemas";

/** Cạnh bản hiển thị cho ô nhỏ trong gallery — BE tạo sẵn 256 / 768 / 1600. */
const THUMB_EDGE = 256;
/** BE `FileCategory.PRODUCT_IMAGE`: JPEG / PNG / WebP, tối đa 10 MB. */
const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Ảnh của một biến thể (BE PR #71). Ảnh mới riêng tư cho tới khi được xuất bản; người xuất bản
 * phải khác người tải lên (BE 409 SELF_APPROVAL_NOT_ALLOWED) và sản phẩm phải đã duyệt.
 */
export function VariantMediaGallery({
  productId,
  variantId,
  canUpload,
  canPublish,
  compact = false,
}: {
  productId: string;
  variantId: string;
  canUpload: boolean;
  canPublish: boolean;
  /** Chỉ xem (thẻ bên phải trang sản phẩm): không có thao tác. */
  compact?: boolean;
}) {
  const query = useVariantMedia(productId, variantId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<VariantMedia | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useUploadVariantMedia();
  const publish = usePublishVariantMedia();
  const withdraw = useWithdrawVariantMedia();
  const remove = useDeleteVariantMedia();
  const makePrimary = useMakePrimaryMedia();
  const target = { productId, variantId };
  const fail = (context: Parameters<typeof variantErrorMessage>[1]) => (e: unknown) =>
    toast.error("Không thực hiện được", variantErrorMessage(e, context));

  if (query.isLoading) return <p className="text-ink-tertiary text-xs">Đang tải ảnh…</p>;
  if (query.isError) {
    return (
      <p role="alert" className="text-danger text-xs">
        {variantErrorMessage(query.error, "media")}
      </p>
    );
  }
  const media = query.data ?? [];
  const unpublishedSelected = media.filter((m) => selected.has(m.mediaId) && !m.published);
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-3">
      {media.length === 0 ? (
        <div className="border-border-default text-ink-tertiary flex flex-col items-center gap-1 rounded-[var(--r-sm)] border border-dashed py-6 text-xs">
          <ImageOff className="size-5 opacity-60" />
          Chưa có ảnh
        </div>
      ) : (
        <ul className={compact ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-3"}>
          {media.map((m) => (
            <li key={m.mediaId} className="space-y-1">
              <label className="relative block">
                <Thumb productId={productId} variantId={variantId} media={m} />
                {!compact && canPublish && !m.published && (
                  <input
                    type="checkbox"
                    aria-label={`Chọn ảnh ${m.originalName ?? m.mediaId} để xuất bản`}
                    checked={selected.has(m.mediaId)}
                    onChange={() => toggle(m.mediaId)}
                    className="accent-brand absolute top-1.5 left-1.5 size-4"
                  />
                )}
                <span className="absolute top-1.5 right-1.5 flex gap-1">
                  {m.primary && <Badge tone="accent">Ảnh bìa</Badge>}
                  <Badge tone={m.published ? "positive" : "muted"}>
                    {m.published ? "Đã xuất bản" : "Riêng tư"}
                  </Badge>
                </span>
              </label>
              {!compact && (
                <div className="flex flex-wrap items-center gap-1">
                  {canUpload && !m.primary && (
                    <IconButton
                      label="Đặt làm ảnh bìa"
                      disabled={makePrimary.isPending}
                      onClick={() =>
                        makePrimary.mutate({ ...target, media: m }, { onError: fail("media") })
                      }
                    >
                      <Star className="size-3.5" />
                    </IconButton>
                  )}
                  {canPublish && m.published && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={withdraw.isPending}
                      onClick={() =>
                        withdraw.mutate(
                          { ...target, mediaId: m.mediaId },
                          { onError: fail("media") },
                        )
                      }
                    >
                      Gỡ khỏi cửa hàng
                    </Button>
                  )}
                  {canUpload && (
                    <IconButton label="Xoá ảnh" onClick={() => setDeleting(m)} danger>
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!compact && (
        <div className="flex flex-wrap items-center gap-2">
          {canUpload && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                aria-label="Chọn ảnh để tải lên"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (file.size > MAX_BYTES) {
                    toast.error("Ảnh quá lớn", "Mỗi ảnh tối đa 10 MB.");
                    return;
                  }
                  upload.mutate({ ...target, file }, { onError: fail("upload") });
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={upload.isPending}
                onClick={() => fileInput.current?.click()}
              >
                <Upload className="size-3.5" />
                {upload.isPending ? "Đang tải lên…" : "Tải ảnh lên"}
              </Button>
            </>
          )}
          {canPublish && unpublishedSelected.length > 0 && (
            <Button
              type="button"
              size="sm"
              disabled={publish.isPending || unpublishedSelected.length > PUBLISH_MEDIA_MAX}
              onClick={() =>
                publish.mutate(
                  { ...target, mediaIds: unpublishedSelected.map((m) => m.mediaId) },
                  { onSuccess: () => setSelected(new Set()), onError: fail("publish") },
                )
              }
            >
              Xuất bản {unpublishedSelected.length} ảnh
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Xoá ảnh?"
        description={`Ảnh ${deleting?.originalName ?? ""} sẽ bị xoá khỏi biến thể và không khôi phục được.`}
        confirmLabel="Xoá ảnh"
        loading={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(
            { ...target, mediaId: deleting.mediaId },
            { onSettled: () => setDeleting(null), onError: fail("media") },
          );
        }}
      />
    </div>
  );
}

function Thumb({
  productId,
  variantId,
  media,
}: {
  productId: string;
  variantId: string;
  media: VariantMedia;
}) {
  const url = useMediaViewUrl(productId, variantId, media, THUMB_EDGE);
  const alt = media.altText || media.originalName || "Ảnh biến thể";
  return (
    <span className="border-border-default bg-bg-subtle flex aspect-square items-center justify-center overflow-hidden rounded-[var(--r-sm)] border">
      {url.data ? (
        // Link có hạn do BE ký — không qua next/image (domain thay đổi theo kho ảnh).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url.data} alt={alt} className="size-full object-cover" />
      ) : (
        <span className="text-ink-tertiary px-2 text-center text-[0.6875rem] break-all">
          {url.isLoading ? "Đang tải…" : (media.originalName ?? "Không xem trước được")}
        </span>
      )}
    </span>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "accent" | "positive" | "muted";
  children: React.ReactNode;
}) {
  const cls = {
    accent: "bg-accent text-ink-inverse",
    positive: "bg-positive text-white",
    muted: "bg-bg-surface/90 text-ink-secondary border-border-default border",
  }[tone];
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={danger ? "text-danger hover:bg-danger/10 h-7 px-2" : "h-7 px-2"}
    >
      {children}
    </Button>
  );
}
