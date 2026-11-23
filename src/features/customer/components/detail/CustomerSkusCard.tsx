"use client";

import { useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import {
  customerSkuActionError,
  useCustomerSkus,
  useTransitionCustomerSku,
} from "@/lib/references/customer-skus";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DetailSection } from "@/components/shared/DetailSection";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import type { CustomerSku, CustomerSkuAction } from "@/lib/references/customer-skus";

const NOTE = "text-ink-tertiary text-xs";
const ACTION_LABEL: Record<CustomerSkuAction, string> = {
  activate: "Kích hoạt",
  block: "Tạm chặn",
  obsolete: "Ngừng dùng",
};
const CONFIRM: Partial<Record<CustomerSkuAction, (sku: string) => [string, string]>> = {
  block: (sku) => [
    `Tạm chặn SKU ${sku}?`,
    "Khách và Sale không đưa SKU này vào báo giá / đơn mới cho tới khi kích hoạt lại.",
  ],
  obsolete: (sku) => [
    `Ngừng dùng SKU ${sku}?`,
    "SKU riêng ngừng dùng không bán lại được và không hoàn tác. Chứng từ cũ vẫn giữ nguyên.",
  ],
};

/**
 * SKU riêng của khách (docs 01 §1 "SKU thành phẩm theo mẫu của khách", §2; 12 §4.6 bước 18): sinh khi thiết kế được
 * duyệt, không tạo tay. Sale tra để đưa vào báo giá; Quản lý kinh doanh khoá / ngừng dùng. BE
 * `GET /customer-skus?customerId=` (`product-variants:READ`). Quyền chuyển trạng thái UI-only — BE re-check.
 */
export function CustomerSkusCard({
  customerId,
  canRead,
  canBlock,
  canApprove,
}: {
  customerId: string;
  canRead: boolean;
  /** `product-variants:UPDATE` — tạm chặn. */
  canBlock: boolean;
  /** `product-variants:APPROVE` — kích hoạt / ngừng dùng. */
  canApprove: boolean;
}) {
  const query = useCustomerSkus(customerId, canRead);
  const transition = useTransitionCustomerSku();
  const [pending, setPending] = useState<{ sku: CustomerSku; action: CustomerSkuAction } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  if (!canRead) return null;

  const run = (sku: CustomerSku, action: CustomerSkuAction) =>
    transition.mutate(
      { sku, action },
      {
        onSuccess: () => setPending(null),
        onError: (e) => setError(customerSkuActionError(e)),
      },
    );
  const start = (sku: CustomerSku, action: CustomerSkuAction) => {
    setError(null);
    if (CONFIRM[action]) setPending({ sku, action });
    else run(sku, action);
  };
  const actionsOf = (sku: CustomerSku): CustomerSkuAction[] => {
    const out: CustomerSkuAction[] = [];
    if (sku.status === "BLOCKED" && canApprove) out.push("activate");
    if (sku.status === "ACTIVE" && canBlock) out.push("block");
    if (sku.status !== "OBSOLETE" && canApprove) out.push("obsolete");
    return out;
  };
  const confirmCopy = pending ? CONFIRM[pending.action]?.(pending.sku.sku) : undefined;

  return (
    <DetailSection title="SKU riêng của khách" icon={Package}>
      {query.isPending ? (
        <p className={NOTE}>Đang tải SKU riêng…</p>
      ) : query.isError ? (
        <p role="alert" className="text-danger text-xs">
          Không tải được SKU riêng của khách.
        </p>
      ) : query.data.length === 0 ? (
        <p className={NOTE}>
          Khách chưa có SKU riêng — SKU riêng sinh tự động khi thiết kế của khách được duyệt.
        </p>
      ) : (
        <ul className="divide-y divide-(--table-line) text-[0.8125rem]">
          {query.data.map((sku) => (
            <li
              key={sku.variantId}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div className="min-w-0">
                <Link
                  href={ADMIN_ROUTES.products.detail(sku.productId)}
                  className="text-accent-text font-[family-name:var(--font-mono)] hover:underline"
                >
                  {sku.sku}
                </Link>
                <p className="text-ink-primary truncate">{sku.name}</p>
                {sku.sourceSku && <p className={NOTE}>Từ quy cách {sku.sourceSku}</p>}
              </div>
              <div className="flex items-center gap-2">
                <StatusDot domain="sku" status={sku.status} size="sm" />
                {actionsOf(sku).map((action) => (
                  <Button
                    key={action}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={transition.isPending}
                    onClick={() => start(sku, action)}
                  >
                    {ACTION_LABEL[action]}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && !pending && (
        <p role="alert" className="text-danger mt-2 text-xs">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={confirmCopy?.[0] ?? ""}
        description={confirmCopy?.[1] ?? ""}
        confirmLabel={pending ? ACTION_LABEL[pending.action] : ""}
        variant="danger"
        loading={transition.isPending}
        closeOnConfirm={false}
        error={error}
        onConfirm={() => pending && run(pending.sku, pending.action)}
      />
    </DetailSection>
  );
}
