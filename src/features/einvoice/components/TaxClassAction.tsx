"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tags } from "lucide-react";

import { PRODUCT_TAX_CLASS_PERMISSION } from "@/constants/einvoice";
import { PRODUCT_UI_LABELS } from "@/constants/labels-product";
import { apiErrorMessage } from "@/lib/api/error-message";
import { useCan } from "@/lib/auth/components/Can";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { TAX_CLASSES, changeProductTaxClass, listProductTaxClasses } from "../tax-class-api";

import type { ProductTaxClass, TaxClass } from "../tax-class-api";
import type { EInvoice } from "../types";

const LABELS = PRODUCT_UI_LABELS.taxClass;
const REASON_MAX = 500;
const MESSAGES = {
  OPTIMISTIC_LOCK: "Sản phẩm vừa được người khác sửa — đóng hộp thoại rồi mở lại để lấy bản mới.",
  PRODUCT_NOT_FOUND: "Không tìm thấy sản phẩm.",
  FORBIDDEN: "Bạn không có quyền đổi nhóm thuế sản phẩm.",
} as const;

/** Cảnh báo trên nháp mà cách sửa là gán / đổi nhóm thuế của sản phẩm. */
const FIXED_BY_TAX_CLASS = ["TAX_CLASS_UNKNOWN", "TAX_EXEMPT_NOT_SUPPORTED"];

function skusOf(invoice: EInvoice): string[] {
  const skus = invoice.lines
    .filter((line) => line.kind === "GOODS" && line.sku)
    .map((line) => line.sku as string);
  return [...new Set(skus)];
}

function ProductRow({ product, onDone }: { product: ProductTaxClass; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [taxClass, setTaxClass] = useState<TaxClass | "">(product.taxClass ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: changeProductTaxClass,
    onSuccess: () => {
      setError(null);
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["product-tax-classes"] });
      onDone();
    },
    onError: (failure) => setError(apiErrorMessage(failure, MESSAGES)),
  });
  const id = `tax-class-${product.productId}`;
  const changed = taxClass !== "" && taxClass !== product.taxClass;
  const canSave = changed && reason.trim().length > 0 && !change.isPending;
  return (
    <li className="border-border-default space-y-2 rounded-[var(--r-sm)] border p-3">
      <div className="text-[0.8125rem]">
        <span className="text-ink-primary font-medium">{product.productName}</span>{" "}
        <span className="text-ink-tertiary font-mono text-xs">
          {product.productCode}
          {product.sku ? ` · ${product.sku}` : ""}
        </span>
        <div className="text-ink-secondary text-xs">
          Hiện tại: {product.taxClass ? LABELS[product.taxClass] : "Chưa xác định"}
        </div>
      </div>
      <FormField id={`${id}-class`} label="Nhóm thuế mới" required>
        <select
          id={`${id}-class`}
          value={taxClass}
          onChange={(event) => setTaxClass(event.target.value as TaxClass | "")}
          className={`${FORM_INPUT_CLASS} border px-2`}
        >
          <option value="">Chọn nhóm thuế</option>
          {TAX_CLASSES.map((value) => (
            <option key={value} value={value}>
              {LABELS[value]}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id={`${id}-reason`} label="Lý do" required>
        <Textarea
          id={`${id}-reason`}
          rows={2}
          maxLength={REASON_MAX}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormField>
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
      <Button
        type="button"
        size="sm"
        disabled={!canSave}
        onClick={() =>
          taxClass !== "" &&
          change.mutate({
            productId: product.productId,
            taxClass,
            reason: reason.trim(),
            version: product.version,
          })
        }
      >
        Lưu nhóm thuế
      </Button>
    </li>
  );
}

function TaxClassBody({ invoice, onClose }: { invoice: EInvoice; onClose: () => void }) {
  const skus = skusOf(invoice);
  const [saved, setSaved] = useState(false);
  const products = useQuery({
    queryKey: ["product-tax-classes", ...skus],
    queryFn: () => listProductTaxClasses(skus),
    enabled: skus.length > 0,
  });
  return (
    <FormDialogBody
      title="Gán nhóm thuế cho sản phẩm"
      description="Nhóm thuế quyết định thuế suất trên báo giá và hoá đơn lập từ bây giờ. Nháp này giữ thuế suất cũ: sau khi lưu, huỷ nháp rồi lập lại để áp dụng."
      submitLabel="Đóng"
      canSubmit
      hideCancel
      isPending={false}
      error={products.isError ? apiErrorMessage(products.error, MESSAGES) : null}
      onCancel={onClose}
      onSubmit={onClose}
    >
      {products.isPending && skus.length > 0 && (
        <p className="text-ink-secondary text-[0.8125rem]">Đang tải sản phẩm…</p>
      )}
      {products.data && products.data.length === 0 && (
        <p className="text-ink-secondary text-[0.8125rem]">
          Không tìm thấy sản phẩm của các mã trên hoá đơn.
        </p>
      )}
      {products.data && products.data.length > 0 && (
        <ul className="space-y-3">
          {products.data.map((product) => (
            <ProductRow key={product.productId} product={product} onDone={() => setSaved(true)} />
          ))}
        </ul>
      )}
      {saved && (
        <p role="status" className="text-ink-secondary text-[0.8125rem]">
          Đã lưu nhóm thuế. Huỷ nháp này rồi lập lại để hoá đơn theo nhóm mới.
        </p>
      )}
    </FormDialogBody>
  );
}

/**
 * Nút "Gán nhóm thuế cho sản phẩm" cạnh cảnh báo của nháp (demo D-8): nháp có `TAX_CLASS_UNKNOWN` (hoặc dòng 0% NCC
 * chưa ghi được) là chỗ duy nhất bảo Kế toán gán nhóm thuế — giờ nó cho làm luôn. Chỉ với nháp và người có quyền
 * `product-tax-class:UPDATE`; BE kiểm lại.
 */
export function TaxClassAction({ invoice }: { invoice: EInvoice }) {
  const canChange = useCan(PRODUCT_TAX_CLASS_PERMISSION);
  const [open, setOpen] = useState(false);
  const relevant =
    invoice.status === "DRAFT" &&
    invoice.warnings.some((code) => FIXED_BY_TAX_CLASS.includes(code));
  if (!canChange || !relevant || skusOf(invoice).length === 0) return null;
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Tags className="size-3.5" aria-hidden="true" /> Gán nhóm thuế cho sản phẩm
      </Button>
      <FormDialog open={open} onOpenChange={setOpen}>
        {open && <TaxClassBody invoice={invoice} onClose={() => setOpen(false)} />}
      </FormDialog>
    </>
  );
}
