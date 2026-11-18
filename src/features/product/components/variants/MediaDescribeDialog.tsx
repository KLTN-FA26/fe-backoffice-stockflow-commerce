"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { variantErrorMessage } from "../../variant-errors";
import { useDescribeVariantMedia } from "../../variant-queries";
import { ProductInput } from "../form-controls";
import { Field } from "./Field";

import type { VariantMedia } from "../../variant-schemas";

/** BE `DescribeMediaRequest`: `altText` ≤ 255, `sortOrder` ≥ 0 (số nguyên). */
const describeSchema = z.object({
  altText: z.string().trim().max(255, "Mô tả ảnh tối đa 255 ký tự"),
  sortOrder: z
    .string()
    .trim()
    .regex(/^\d{1,9}$/, "Thứ tự là số nguyên từ 0 trở lên"),
});
type DescribeValues = z.infer<typeof describeSchema>;

/**
 * Sửa mô tả (alt) và thứ tự một ảnh — BE `PUT …/media/{id}` (`product-products:UPDATE`); giữ nguyên cờ ảnh bìa.
 * UI-only — Backend phải re-check.
 */
export function MediaDescribeDialog({
  productId,
  variantId,
  media,
  onClose,
}: {
  productId: string;
  variantId: string;
  media: VariantMedia | null;
  onClose: () => void;
}) {
  return (
    <FormDialog open={media !== null} onOpenChange={(open) => !open && onClose()}>
      {media && (
        <DescribeForm productId={productId} variantId={variantId} media={media} onDone={onClose} />
      )}
    </FormDialog>
  );
}

function DescribeForm({
  productId,
  variantId,
  media,
  onDone,
}: {
  productId: string;
  variantId: string;
  media: VariantMedia;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const describe = useDescribeVariantMedia();
  const form = useForm<DescribeValues>({
    resolver: zodResolver(describeSchema),
    mode: "onChange",
    defaultValues: { altText: media.altText ?? "", sortOrder: String(media.sortOrder) },
  });
  const { errors, isValid } = form.formState;
  const submit = form.handleSubmit((values) => {
    setError(null);
    describe.mutate(
      {
        productId,
        variantId,
        media,
        altText: values.altText.trim() || null,
        sortOrder: Number(values.sortOrder),
      },
      { onSuccess: onDone, onError: (e) => setError(variantErrorMessage(e, "media")) },
    );
  });
  return (
    <FormDialogBody
      title={`Sửa ảnh ${media.originalName ?? ""}`.trim()}
      description="Mô tả ảnh (alt) giúp người dùng trình đọc màn hình và SEO; ảnh có thứ tự nhỏ hơn đứng trước."
      submitLabel="Lưu"
      canSubmit={isValid}
      isPending={describe.isPending}
      error={error}
      onSubmit={() => void submit()}
      onCancel={onDone}
    >
      <Field label="Mô tả ảnh (alt)" id="media-alt" error={errors.altText?.message}>
        <ProductInput id="media-alt" {...form.register("altText")} autoFocus />
      </Field>
      <Field label="Thứ tự" id="media-sort" error={errors.sortOrder?.message}>
        <ProductInput
          id="media-sort"
          inputMode="numeric"
          {...form.register("sortOrder")}
          className="text-right tabular-nums"
        />
      </Field>
    </FormDialogBody>
  );
}
