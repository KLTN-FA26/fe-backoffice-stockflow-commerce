"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import { ADMIN_ROUTES, PRODUCT_STATUS, PRODUCT_PERMISSIONS } from "@/constants";

import { ApiError } from "@/lib/api";
import { useCan } from "@/lib/auth/components/Can";

import {
  buildCreateProductInput,
  mapCreateProductError,
  PRODUCT_DRAFT_FORM_DEFAULTS,
  productDraftFormSchema,
  productToDraftForm,
  useBrands,
  useCategories,
  useCreateProduct,
  useProduct,
  useUpdateProduct,
} from "@/features/product";

import { useAttributes } from "../attribute-queries";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { previewMatrix } from "../axes-draft";
import { ProductAxesFields, createAxesIssue } from "./ProductAxesFields";
import { ProductMasterFields } from "./ProductMasterFields";
import { ProductFormBackLink, ProductFormForbidden } from "./ProductFormNavigation";

import type { Product, ProductDraftFormValues } from "@/features/product";
import type { AxisDraft } from "../axes-draft";

export function ProductCreate({ productId }: { productId?: string }) {
  const isEditing = Boolean(productId);
  const router = useRouter();
  const canSave = useCan(isEditing ? PRODUCT_PERMISSIONS.update : PRODUCT_PERMISSIONS.create);
  const productQuery = useProduct(productId);
  const categoriesQuery = useCategories();
  const categories = categoriesQuery.data?.items ?? [];
  const brandsQuery = useBrands();
  const brands = brandsQuery.data ?? [];
  // Cùng khoá với danh sách thuộc tính của `ProductAxesFields` → dùng chung bộ nhớ đệm, không gọi thêm.
  const attributesQuery = useAttributes({ active: true }, !isEditing);
  const [serverMessage, setServerMessage] = useState<string>();
  // Trục biến thể chọn ngay khi tạo (BE PR #116) — chỉ khi tạo mới; sản phẩm đã có sửa trục ở trang chi tiết.
  const [axes, setAxes] = useState<AxisDraft[]>([]);
  const form = useForm<ProductDraftFormValues>({
    defaultValues: PRODUCT_DRAFT_FORM_DEFAULTS,
    resolver: zodResolver(productDraftFormSchema),
  });
  const { isDirty } = form.formState;
  const productCode = useWatch({ control: form.control, name: "productCode" });

  useEffect(() => {
    const product = productQuery.data;
    if (!product || isDirty) return;
    form.reset(productToDraftForm(product));
  }, [form, isDirty, productQuery.data]);

  const handleError = (error: unknown) => {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError(0, "UNKNOWN_ERROR", "Không lưu được sản phẩm.");
    const mapped = mapCreateProductError(apiError, axes.length > 0);
    for (const [field, message] of Object.entries(mapped.fieldErrors)) {
      if (!message) continue;
      if (field in PRODUCT_DRAFT_FORM_DEFAULTS) {
        form.setError(field as keyof ProductDraftFormValues, { type: "server", message });
      }
    }
    setServerMessage(mapped.message);
    // 409 OPTIMISTIC_LOCK: lấy lại bản mới nhất (kèm `version` mới) và nạp lại biểu mẫu — gửi tiếp
    // với `version` cũ sẽ lại bị từ chối.
    if (apiError.code === "OPTIMISTIC_LOCK") {
      void productQuery.refetch().then((result) => {
        if (result.data) form.reset(productToDraftForm(result.data));
      });
    }
  };

  const onSuccess = (saved: Product) => {
    setServerMessage(undefined);
    form.reset(productToDraftForm(saved));
    router.push(ADMIN_ROUTES.products.detail(saved.productId));
  };
  const createMutation = useCreateProduct({ onError: handleError, onSuccess });
  const updateMutation = useUpdateProduct({ onError: handleError, onSuccess });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const submit = form.handleSubmit((values) => {
    setServerMessage(undefined);
    if (!productId) {
      const attributes = attributesQuery.data?.items ?? [];
      const blocked = createAxesIssue(axes, previewMatrix(axes, attributes, values.productCode));
      if (blocked) {
        setServerMessage(blocked);
        return;
      }
    }
    const input = buildCreateProductInput(values, productId ? [] : axes);
    if (productId) {
      const version = productQuery.data?.version;
      if (version === undefined) {
        setServerMessage("Chưa tải xong sản phẩm. Hãy thử lại sau giây lát.");
        return;
      }
      const { code: _code, ...update } = input;
      updateMutation.mutate({ id: productId, ...update, version });
    } else {
      createMutation.mutate(input);
    }
  });

  if ((isEditing && productQuery.isLoading) || categoriesQuery.isLoading || brandsQuery.isLoading) {
    return <PageSkeleton variant="form" />;
  }
  if (!canSave) return <ProductFormForbidden isEditing={isEditing} />;
  if (isEditing && productQuery.isError) {
    return (
      <EmptyState
        title="Không tải được sản phẩm"
        description="Không thể mở dữ liệu để chỉnh sửa. Hãy thử lại từ trang danh sách."
      />
    );
  }
  if (isEditing && productQuery.data && productQuery.data.status !== PRODUCT_STATUS.DRAFT) {
    return (
      <EmptyState
        title="Không thể chỉnh sửa sản phẩm"
        description={`Chỉ sản phẩm ở trạng thái Draft mới được chỉnh sửa. Sản phẩm này đang ở trạng thái ${productQuery.data.status}.`}
        action={<ProductFormBackLink />}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={isEditing ? "Chỉnh sửa sản phẩm" : "Tạo sản phẩm"}
        subtitle="Lưu Product master ở trạng thái Draft cùng biến thể: một biến thể mặc định, hoặc đủ ma trận nếu chọn trục."
        actions={<ProductFormBackLink />}
      />
      <form onSubmit={submit} noValidate className="space-y-4 pb-16">
        {serverMessage && (
          <div
            role="alert"
            className="border-danger/30 bg-danger/5 text-danger rounded-[var(--r-sm)] border px-4 py-3 text-sm"
          >
            <p className="font-semibold">Không lưu được sản phẩm</p>
            <p className="mt-1">{serverMessage}</p>
          </div>
        )}
        <ProductMasterFields
          brands={brands}
          categories={categories}
          form={form}
          isEditing={isEditing}
        />
        {!isEditing && (
          <ProductAxesFields productCode={productCode} value={axes} onChange={setAxes} />
        )}
        <div className="border-border-default bg-bg-subtle sticky bottom-0 flex justify-end border-t p-3">
          <Button
            type="submit"
            disabled={isPending}
            className="bg-brand text-ink-inverse hover:bg-brand-hover rounded-[var(--r-sm)]"
          >
            <Save className="size-4" />
            {isPending ? "Đang lưu..." : isEditing ? "Lưu thay đổi" : "Tạo bản nháp"}
          </Button>
        </div>
      </form>
    </>
  );
}
