"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import {
  DISCONTINUE_REASON_MAX,
  PRODUCT_REASON_MAX,
  productTransitionErrorMessage,
  useDeleteProduct,
  useDiscontinueProduct,
  useOpenReferences,
  useResumeProduct,
  useSuspendProduct,
} from "@/features/product";

import { DiscontinueResultDialog } from "./DiscontinueResultDialog";
import { OpenReferencesList } from "./OpenReferencesList";

import type { ApiError } from "@/lib/api";
import type { DiscontinueProductResult, Product } from "@/features/product";

export type LifecycleDialog = "suspend" | "resume" | "discontinue" | "delete" | null;

interface Props {
  product: Product;
  dialog: LifecycleDialog;
  onClose: () => void;
  /** Sản phẩm đã bị xoá — màn chi tiết quay về danh sách. */
  onDeleted: () => void;
  /** 409 OPTIMISTIC_LOCK: lấy lại bản mới nhất để lần gửi sau mang `version` đúng. */
  onStale: () => void;
}

/**
 * Bốn hộp thoại cuối vòng đời sản phẩm (BE SCRUM-461): tạm ngưng, tiếp tục, ngừng kinh doanh, xoá bản
 * nháp. Mỗi thao tác gửi `version` của lần đọc trước; lỗi hiện TRONG hộp thoại (modal che phần còn lại).
 */
export function ProductLifecycleDialogs({ product, dialog, onClose, onDeleted, onStale }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscontinueProductResult | null>(null);
  const suspend = useSuspendProduct();
  const resume = useResumeProduct();
  const discontinue = useDiscontinueProduct();
  const remove = useDeleteProduct();
  const pending =
    suspend.isPending || resume.isPending || discontinue.isPending || remove.isPending;
  // Chỉ tải chứng từ còn mở khi hộp thoại ngừng kinh doanh mở.
  const references = useOpenReferences(product.productId, dialog === "discontinue");

  const fail = (e: ApiError) => {
    setError(productTransitionErrorMessage(e));
    if (e.code === "OPTIMISTIC_LOCK") onStale();
  };
  const settle = { onSuccess: onClose, onError: fail };
  const change = (open: boolean) => {
    if (open || pending) return;
    setError(null);
    onClose();
  };
  const name = product.name;

  return (
    <>
      <ConfirmDialog
        open={dialog === "suspend"}
        onOpenChange={change}
        title="Tạm ngưng sản phẩm?"
        description={`${name} sẽ bị ẩn khỏi cửa hàng và không nhận dòng đơn mua mới. Đơn mua, đơn bán và phiếu nhận đang chạy vẫn được xử lý. Có thể tiếp tục kinh doanh sau.`}
        confirmLabel="Tạm ngưng"
        requireReason
        reasonLabel="Lý do tạm ngưng"
        reasonMaxLength={PRODUCT_REASON_MAX}
        closeOnConfirm={false}
        loading={suspend.isPending}
        error={dialog === "suspend" ? error : null}
        onConfirm={(reason) => {
          if (!reason?.trim()) return;
          setError(null);
          suspend.mutate(
            { id: product.productId, reason: reason.trim(), version: product.version },
            settle,
          );
        }}
      />
      <ConfirmDialog
        open={dialog === "resume"}
        onOpenChange={change}
        title="Tiếp tục kinh doanh?"
        description={`${name} trở về trạng thái Đã duyệt. Muốn hiện lại trên cửa hàng, hãy xuất bản lại sau đó.`}
        confirmLabel="Tiếp tục kinh doanh"
        variant="default"
        closeOnConfirm={false}
        loading={resume.isPending}
        error={dialog === "resume" ? error : null}
        onConfirm={() => {
          setError(null);
          resume.mutate({ id: product.productId, version: product.version }, settle);
        }}
      />
      <ConfirmDialog
        open={dialog === "discontinue"}
        onOpenChange={change}
        title="Ngừng kinh doanh sản phẩm?"
        description={`${name} sẽ ngừng kinh doanh vĩnh viễn, không hoàn tác được. Đơn mua và đơn bán đang mở vẫn được xử lý tiếp.`}
        confirmLabel="Ngừng kinh doanh"
        requireReason
        reasonLabel="Lý do ngừng kinh doanh"
        reasonMaxLength={DISCONTINUE_REASON_MAX}
        closeOnConfirm={false}
        loading={discontinue.isPending}
        error={dialog === "discontinue" ? error : null}
        onConfirm={(reason) => {
          if (!reason?.trim()) return;
          setError(null);
          discontinue.mutate(
            { id: product.productId, reason: reason.trim(), version: product.version },
            {
              onSuccess: (done) => {
                onClose();
                // Không phải lỗi: sản phẩm đã ngừng, nhưng còn chứng từ mở → hiện chi tiết để xử lý tiếp.
                if (done.warnings.length > 0 || done.openReferences.length > 0) setResult(done);
              },
              onError: fail,
            },
          );
        }}
      >
        <DiscontinueReferences query={references} />
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={change}
        title="Xoá sản phẩm nháp?"
        description={`${name} cùng biến thể và ảnh của nó sẽ bị xoá vĩnh viễn, không hoàn tác được.`}
        confirmLabel="Xoá sản phẩm"
        closeOnConfirm={false}
        loading={remove.isPending}
        error={dialog === "delete" ? error : null}
        onConfirm={() => {
          setError(null);
          remove.mutate(
            { id: product.productId, version: product.version },
            { onSuccess: onDeleted, onError: fail },
          );
        }}
      />
      <DiscontinueResultDialog result={result} onClose={() => setResult(null)} />
    </>
  );
}

function DiscontinueReferences({ query }: { query: ReturnType<typeof useOpenReferences> }) {
  if (query.isLoading) {
    return <p className="text-ink-tertiary text-xs">Đang kiểm tra chứng từ còn mở…</p>;
  }
  if (query.isError || !query.data) {
    return (
      <p className="text-ink-tertiary text-xs">
        Không tải được danh sách chứng từ còn mở. Vẫn ngừng kinh doanh được; kết quả sẽ báo lại các
        chứng từ còn mở.
      </p>
    );
  }
  if (query.data.references.length === 0) {
    return (
      <p className="text-ink-tertiary text-xs">
        Hiện không có đơn mua hoặc đơn bán đang mở tham chiếu SKU của sản phẩm.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      <p className="text-warning text-xs font-medium">
        Còn chứng từ đang mở tham chiếu SKU của sản phẩm (vẫn được xử lý tiếp sau khi ngừng):
      </p>
      <OpenReferencesList references={query.data.references} truncated={query.data.truncated} />
    </div>
  );
}
