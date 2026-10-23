"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { ADMIN_ROUTES, PRODUCT_PERMISSIONS } from "@/constants";
import { ApiError } from "@/lib/api";
import { useCan } from "@/lib/auth/components/Can";

import {
  applyServerFieldErrors,
  buildCreateProductInput,
  mapCreateProductError,
  PRODUCT_DRAFT_FORM_DEFAULTS,
  productDraftFormSchema,
  productToDraftForm,
  useBrands,
  useCategories,
  useCreateProduct,
  useUpdateProduct,
} from "@/features/product";

import { PageHeader } from "@/components/shared/PageHeader";

import { useAttributes } from "../attribute-queries";
import { previewMatrix } from "../axes-draft";
import { ProductAxesFields, createAxesIssue } from "./ProductAxesFields";
import { ProductMasterFields } from "./ProductMasterFields";
import { ProductFormBackLink } from "./ProductFormNavigation";
import {
  ProductFormSaveBar,
  ProductFormServerAlert,
  productFormBlock,
  useMatrixCreateConfirm,
} from "./ProductFormParts";
import { useProductEditSource } from "./useProductEditSource";

import type { Product, ProductDraftFormValues } from "@/features/product";
import type { AxisDraft } from "../axes-draft";

export function ProductCreate({ productId }: { productId?: string }) {
  const isEditing = Boolean(productId);
  const router = useRouter();
  const canSave = useCan(isEditing ? PRODUCT_PERMISSIONS.update : PRODUCT_PERMISSIONS.create);
  const categoriesQuery = useCategories();
  const brandsQuery = useBrands();
  // Cùng khoá với danh sách thuộc tính của `ProductAxesFields` → dùng chung bộ nhớ đệm, không gọi thêm.
  const attributesQuery = useAttributes({ active: true }, !isEditing);
  const [serverMessage, setServerMessage] = useState<string>();
  // Trục biến thể chọn ngay khi tạo (BE PR #116) — chỉ khi tạo mới; sản phẩm đã có sửa trục ở trang chi tiết.
  const [axes, setAxes] = useState<AxisDraft[]>([]);
  const form = useForm<ProductDraftFormValues>({
    defaultValues: PRODUCT_DRAFT_FORM_DEFAULTS,
    resolver: zodResolver(productDraftFormSchema),
  });
  const source = useProductEditSource(productId, form);
  const [productCode, categoryId] = useWatch({
    control: form.control,
    name: ["productCode", "categoryId"],
  });

  const handleError = (error: unknown) => {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError(0, "UNKNOWN_ERROR", "Không lưu được sản phẩm.");
    const mapped = mapCreateProductError(apiError, axes.length > 0);
    applyServerFieldErrors(mapped.fieldErrors, form.setError);
    setServerMessage(mapped.message);
    // 409 OPTIMISTIC_LOCK khi sửa: nhận `version` mới, giữ nội dung đang nhập, nêu ô bị đổi
    if (isEditing && apiError.code === "OPTIMISTIC_LOCK") {
      void source.resolveConflict(form.getValues()).then(setServerMessage);
    }
  };

  const onSuccess = (saved: Product) => {
    setServerMessage(undefined);
    form.reset(productToDraftForm(saved));
    router.push(ADMIN_ROUTES.products.detail(saved.productId));
  };
  const createMutation = useCreateProduct({ onError: handleError, onSuccess });
  const updateMutation = useUpdateProduct({ onError: handleError, onSuccess });
  const matrixConfirm = useMatrixCreateConfirm((input) => createMutation.mutate(input));

  const submit = form.handleSubmit((values) => {
    setServerMessage(undefined);
    if (productId) {
      const version = source.baseVersion();
      if (version === undefined) {
        setServerMessage("Chưa tải xong sản phẩm. Hãy thử lại sau giây lát.");
        return;
      }
      const { code: _code, ...update } = buildCreateProductInput(values);
      updateMutation.mutate({ id: productId, ...update, version });
      return;
    }
    const preview = previewMatrix(axes, attributesQuery.data?.items ?? [], values.productCode);
    // Kiểm trục trước khi dựng request (`toAxisInputs` parse zod — trục rỗng sẽ ném lỗi); trục sinh
    // nhiều hơn một SKU → xác nhận số SKU trước khi tạo cả ma trận
    const axesIssue = createAxesIssue(axes, preview);
    if (axesIssue) return setServerMessage(axesIssue);
    const skuCount = axes.length > 0 ? preview.total : 1;
    matrixConfirm.request(buildCreateProductInput(values, axes), skuCount);
  });

  const blocked = productFormBlock({
    isEditing,
    canSave,
    loading:
      (isEditing && source.query.isLoading) || categoriesQuery.isLoading || brandsQuery.isLoading,
    loadFailed: source.query.isError,
    product: source.query.data,
  });
  if (blocked) return blocked;

  return (
    <>
      <PageHeader
        title={isEditing ? "Chỉnh sửa sản phẩm" : "Tạo sản phẩm"}
        subtitle="Lưu Product master ở trạng thái Draft cùng biến thể: một biến thể mặc định, hoặc đủ ma trận nếu chọn trục."
        actions={<ProductFormBackLink />}
      />
      <form onSubmit={submit} noValidate className="space-y-4 pb-16">
        <ProductFormServerAlert message={serverMessage} />
        <ProductMasterFields
          brands={brandsQuery.data ?? []}
          categories={categoriesQuery.data?.items ?? []}
          form={form}
          isEditing={isEditing}
        />
        {!isEditing && (
          <ProductAxesFields
            productCode={productCode}
            categoryId={categoryId}
            value={axes}
            onChange={setAxes}
          />
        )}
        <ProductFormSaveBar
          isEditing={isEditing}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      </form>
      {matrixConfirm.dialog}
    </>
  );
}
