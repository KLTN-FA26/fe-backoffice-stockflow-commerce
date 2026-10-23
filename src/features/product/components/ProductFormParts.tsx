"use client";

import { useState } from "react";
import { Save } from "lucide-react";

import { PRODUCT_STATUS, UI_LABELS } from "@/constants";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { ProductFormBackLink, ProductFormForbidden } from "./ProductFormNavigation";

import type { ReactNode } from "react";
import type { CreateProductInput } from "../schemas";
import type { Product } from "../types";

/**
 * Trang thay cho form khi chưa mở được: đang tải, thiếu quyền, tải lỗi, sản phẩm đã rời Nháp (chỉ
 * Nháp mới sửa thông tin chung). `null` = mở form.
 */
export function productFormBlock({
  isEditing,
  canSave,
  loading,
  loadFailed,
  product,
}: {
  isEditing: boolean;
  canSave: boolean;
  loading: boolean;
  loadFailed: boolean;
  product: Product | undefined;
}): ReactNode {
  if (loading) return <PageSkeleton variant="form" />;
  if (!canSave) return <ProductFormForbidden isEditing={isEditing} />;
  if (isEditing && loadFailed) {
    return (
      <EmptyState
        title="Không tải được sản phẩm"
        description="Không thể mở dữ liệu để chỉnh sửa. Hãy thử lại từ trang danh sách."
      />
    );
  }
  if (isEditing && product && product.status !== PRODUCT_STATUS.DRAFT) {
    return (
      <EmptyState
        title="Không thể chỉnh sửa sản phẩm"
        description={`Chỉ sản phẩm ở trạng thái Draft mới được chỉnh sửa. Sản phẩm này đang ở trạng thái ${product.status}.`}
        action={<ProductFormBackLink />}
      />
    );
  }
  return null;
}

export function ProductFormServerAlert({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="border-danger/30 bg-danger/5 text-danger rounded-[var(--r-sm)] border px-4 py-3 text-sm"
    >
      <p className="font-semibold">Không lưu được sản phẩm</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

export function ProductFormSaveBar({
  isEditing,
  isPending,
}: {
  isEditing: boolean;
  isPending: boolean;
}) {
  return (
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
  );
}

/** Lần tạo kèm trục đang chờ xác nhận số SKU (BE tạo cả ma trận trong một giao dịch). */
interface PendingMatrixCreate {
  input: CreateProductInput;
  count: number;
}

/**
 * Tạo sản phẩm: sinh nhiều hơn một SKU thì hỏi xác nhận trước khi gọi `create`; một SKU thì tạo
 * luôn. `dialog` đặt NGOÀI thẻ `<form>` của trang (xem `CreateMatrixConfirm`).
 */
export function useMatrixCreateConfirm(create: (input: CreateProductInput) => void) {
  const [pending, setPending] = useState<PendingMatrixCreate | null>(null);
  return {
    request: (input: CreateProductInput, count: number) =>
      count > 1 ? setPending({ input, count }) : create(input),
    dialog: (
      <CreateMatrixConfirm
        pending={pending}
        onCancel={() => setPending(null)}
        onConfirm={(input) => {
          setPending(null);
          create(input);
        }}
      />
    ),
  };
}

/**
 * Xác nhận "sẽ tạo N SKU" trước khi POST sản phẩm kèm trục — ma trận lớn không được tạo âm thầm.
 * Đặt NGOÀI thẻ `<form>` của trang: submit trong dialog (portal) vẫn nổi bọt theo cây React.
 */
function CreateMatrixConfirm({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: PendingMatrixCreate | null;
  onCancel: () => void;
  onConfirm: (input: CreateProductInput) => void;
}) {
  const L = UI_LABELS.product.create;
  const count = pending?.count ?? 0;
  return (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => !open && onCancel()}
      title={L.confirmTitle(count)}
      description={L.confirmDescription(count)}
      confirmLabel={L.confirm}
      variant="default"
      onConfirm={() => pending && onConfirm(pending.input)}
    />
  );
}
