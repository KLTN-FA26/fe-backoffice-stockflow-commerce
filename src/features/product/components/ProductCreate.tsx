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

import { useAttributes } from "../attribute-queries";
import { previewMatrix } from "../axes-draft";
import { useProductWizard } from "./create/useProductWizard";
import { stepOfField } from "./create/wizard-steps";
import { createAxesIssue } from "./ProductAxesFields";
import { productFormBlock, useMatrixCreateConfirm } from "./ProductFormParts";
import { ProductWizardView } from "./ProductWizardView";
import { useProductEditSource } from "./useProductEditSource";

import type { Product, ProductDraftFormValues } from "@/features/product";
import type { AxisDraft } from "../axes-draft";

/**
 * Tạo (`productId` trống) / sửa nháp sản phẩm theo wizard — Thông tin chung → Mô tả → Trục biến thể
 * (chỉ khi tạo) → Rà soát. Wizard chỉ lo chuyển bước; lưu, xử lý lỗi BE, xác nhận số SKU ở đây.
 */
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
  const attributes = attributesQuery.data?.items ?? [];
  // Cùng cách tính với `ProductAxesFields` — chặn "Tiếp tục" ở bước trục khi ma trận lỗi
  const matrix = previewMatrix(axes, attributes, productCode || "MÃ");
  const wizard = useProductWizard({
    form,
    isEditing,
    axesIssue: isEditing ? null : createAxesIssue(axes, matrix),
  });

  const handleError = (error: unknown) => {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError(0, "UNKNOWN_ERROR", "Không lưu được sản phẩm.");
    const mapped = mapCreateProductError(apiError, axes.length > 0);
    applyServerFieldErrors(mapped.fieldErrors, form.setError);
    // Lỗi theo ô → về bước sớm nhất chứa ô lỗi; lỗi chung / lỗi trục ở lại bước rà soát
    wizard.jumpToEarliest(Object.keys(mapped.fieldErrors).flatMap((f) => stepOfField(f) ?? []));
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
    const preview = previewMatrix(axes, attributes, values.productCode);
    // Kiểm trục trước khi dựng request (`toAxisInputs` parse zod — trục rỗng sẽ ném lỗi); trục sinh
    // nhiều hơn một SKU → xác nhận số SKU trước khi tạo cả ma trận
    const axesIssue = createAxesIssue(axes, preview);
    if (axesIssue) {
      wizard.jumpToEarliest(["axes"]);
      return setServerMessage(axesIssue);
    }
    const skuCount = axes.length > 0 ? preview.total : 1;
    matrixConfirm.request(buildCreateProductInput(values, axes), skuCount);
  }, wizard.jumpToErrors);

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
    <ProductWizardView
      wizard={wizard}
      form={form}
      isEditing={isEditing}
      brands={brandsQuery.data ?? []}
      categories={categoriesQuery.data?.items ?? []}
      productCode={productCode}
      categoryId={categoryId}
      axes={axes}
      onAxesChange={setAxes}
      matrix={axes.length > 0 && matrix.total > 0 ? matrix : null}
      serverMessage={serverMessage}
      isPending={createMutation.isPending || updateMutation.isPending}
      onSubmit={() => void submit()}
      confirmDialog={matrixConfirm.dialog}
    />
  );
}
