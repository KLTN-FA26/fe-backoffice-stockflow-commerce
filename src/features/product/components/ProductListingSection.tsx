"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { PRODUCT_PERMISSIONS, PRODUCT_STATUS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { listingErrorMessage } from "../listing-errors";
import { useListing, useRefreshOnConflict, useSaveListing } from "../listing-queries";
import { listingFormSchema, normalizeSlug } from "../listing-schemas";
import { Field } from "./variants/Field";

import type { Listing, ListingFormValues } from "../listing-schemas";
import type { ProductStatus } from "../types";

/**
 * Thông tin bán trên cửa hàng của sản phẩm (BE `GET/PUT /products/{id}/ecommerce`): đường dẫn (slug) và
 * SEO. Giá bán đặt theo từng SKU trong panel biến thể. Cần lưu mục này trước khi đặt giá và xuất bản.
 * Sản phẩm đã ngừng kinh doanh không sửa được (BE 409 CONFLICT); backend phải re-check.
 */
export function ProductListingSection({
  productId,
  status,
}: {
  productId: string;
  status: ProductStatus;
}) {
  const can = usePermissionChecker();
  const query = useListing(productId);
  const [editing, setEditing] = useState(false);
  const canEdit = can(PRODUCT_PERMISSIONS.update) && status !== PRODUCT_STATUS.DISCONTINUED;

  if (query.isLoading) return <p className="text-ink-tertiary text-[0.8125rem]">Đang tải…</p>;
  if (query.isError || !query.data) {
    return (
      <p role="alert" className="text-danger text-[0.8125rem]">
        {listingErrorMessage(query.error)}
      </p>
    );
  }
  const listing = query.data;
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8125rem]">
        <Item label="Đường dẫn (slug)" value={listing.slug || "Chưa đặt"} mono />
        <Item
          label="Hiển thị trên cửa hàng"
          value={listing.published ? "Đang hiển thị" : "Chưa hiển thị"}
        />
        <Item label="Tiêu đề SEO" value={listing.seoTitle || "Chưa đặt"} />
        <Item label="Mô tả SEO" value={listing.seoDescription || "Chưa đặt"} />
      </dl>
      {listing.projectionPending && (
        <p className="text-warning text-xs">
          Thay đổi vừa lưu đang được cập nhật lên cửa hàng, sẽ hiển thị sau ít phút.
        </p>
      )}
      {canEdit && (
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" /> Sửa thông tin cửa hàng
        </Button>
      )}
      <FormDialog open={editing} onOpenChange={setEditing}>
        {editing && (
          <ListingForm productId={productId} listing={listing} onDone={() => setEditing(false)} />
        )}
      </FormDialog>
    </div>
  );
}

function Item({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-ink-tertiary text-xs">{label}</dt>
      <dd className={mono ? "font-[family-name:var(--font-mono)]" : "line-clamp-3"}>{value}</dd>
    </div>
  );
}

function ListingForm({
  productId,
  listing,
  onDone,
}: {
  productId: string;
  listing: Listing;
  onDone: () => void;
}) {
  const [values, setValues] = useState<ListingFormValues>({
    slug: listing.slug ?? "",
    seoTitle: listing.seoTitle ?? "",
    seoDescription: listing.seoDescription ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const save = useSaveListing();
  const refreshOnConflict = useRefreshOnConflict();
  const parsed = listingFormSchema.safeParse(values);
  const issueOf = (field: keyof ListingFormValues) =>
    parsed.success ? undefined : parsed.error.issues.find((i) => i.path[0] === field)?.message;
  const normalized = normalizeSlug(values.slug);

  return (
    <FormDialogBody
      title="Thông tin cửa hàng"
      description="Đường dẫn và nội dung SEO của sản phẩm trên cửa hàng. Sản phẩm từng xuất bản thì không đổi được đường dẫn."
      submitLabel="Lưu"
      canSubmit={parsed.success}
      isPending={save.isPending}
      error={error}
      onSubmit={() => {
        if (!parsed.success) return;
        setError(null);
        save.mutate(
          { productId, revision: listing.revision, values: parsed.data },
          {
            onSuccess: onDone,
            onError: (e) => {
              setError(listingErrorMessage(e));
              refreshOnConflict(e);
            },
          },
        );
      }}
      onCancel={onDone}
    >
      <Field
        label="Đường dẫn (slug) *"
        id="listing-slug"
        hint={normalized ? `Sẽ lưu là: ${normalized}` : undefined}
        error={values.slug ? issueOf("slug") : undefined}
      >
        <Input
          id="listing-slug"
          value={values.slug}
          onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value }))}
          className="font-[family-name:var(--font-mono)]"
          autoFocus
        />
      </Field>
      <Field label="Tiêu đề SEO" id="listing-seo-title" error={issueOf("seoTitle")}>
        <Input
          id="listing-seo-title"
          value={values.seoTitle}
          onChange={(e) => setValues((v) => ({ ...v, seoTitle: e.target.value }))}
        />
      </Field>
      <Field label="Mô tả SEO" id="listing-seo-description" error={issueOf("seoDescription")}>
        <Textarea
          id="listing-seo-description"
          rows={3}
          value={values.seoDescription}
          onChange={(e) => setValues((v) => ({ ...v, seoDescription: e.target.value }))}
        />
      </Field>
    </FormDialogBody>
  );
}
