"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EINVOICE_PERMISSIONS, EINVOICE_ROUTES } from "@/constants/einvoice";
import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { useCan } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { useEInvoice } from "../queries";
import { invoiceReference } from "../selectors";

import { EINVOICE_COPY } from "./copy";
import { CorrectionsCard } from "./CorrectionsCard";
import { EInvoiceActions } from "./EInvoiceActions";
import { ErrorNoticesCard } from "./ErrorNoticesCard";
import { EInvoiceInfoCard } from "./EInvoiceInfoCard";
import { EInvoiceLinesCard } from "./EInvoiceLinesCard";
import { ProviderCallsCard } from "./ProviderCallsCard";

import type { ReactNode } from "react";
import type { EInvoiceAction } from "../lifecycle";
import type { EInvoice } from "../types";

function EInvoiceDetailContent({
  id,
  extra,
  sections,
}: {
  id: string;
  extra?: (invoice: EInvoice) => (action: EInvoiceAction) => ReactNode;
  sections?: (invoice: EInvoice) => ReactNode;
}) {
  const canRead = useCan(EINVOICE_PERMISSIONS.read);
  const query = useEInvoice(id, { enabled: canRead });
  useBreadcrumbLabel(id, query.data ? invoiceReference(query.data) : undefined);
  const back = { href: EINVOICE_ROUTES.list };
  if (!canRead)
    return <LoadErrorState error={null} kind="no-read" copy={EINVOICE_COPY} back={back} />;
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={EINVOICE_COPY}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending) return <PageSkeleton variant="detail" />;
  const invoice = query.data;

  return (
    <div className="surface-soft surface-compact space-y-4">
      <h1 className="sr-only">{`${EINVOICE_LABELS.list.pageTitle} ${invoiceReference(invoice)}`}</h1>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={EINVOICE_ROUTES.list}>
            <ArrowLeft className="size-3.5" /> {EINVOICE_LABELS.list.pageTitle}
          </Link>
        </Button>
        <EInvoiceActions invoice={invoice} extra={extra?.(invoice)} />
      </div>
      {invoice.status === "SUBMITTING" && !invoice.warnings.includes("UNKNOWN_TO_PROVIDER") && (
        <p role="status" className="text-ink-secondary text-[0.8125rem]">
          Đang chờ nhà cung cấp trả kết quả — trang tự cập nhật.
        </p>
      )}
      <EInvoiceInfoCard invoice={invoice} />
      <EInvoiceLinesCard invoice={invoice} />
      {(invoice.status === "ISSUED" || invoice.status === "REPLACED") && (
        <CorrectionsCard id={invoice.id} />
      )}
      {invoice.status === "ISSUED" && <ErrorNoticesCard id={invoice.id} />}
      {sections?.(invoice)}
      <ProviderCallsCard id={invoice.id} />
    </div>
  );
}

/**
 * Chi tiết hoá đơn điện tử và phát hành (docs 21 §4.1–4.3, §4.5): sửa / làm mới bên mua, phát hành,
 * tra lại, gửi lại, mở lại, huỷ nháp, tải XML / PDF; nhật ký gọi nhà cung cấp. `extra` / `sections`
 * gắn điều chỉnh, thay thế, thoả thuận, thông báo sai sót (docs 21 §4.4).
 */
export function EInvoiceDetail(props: {
  id: string;
  extra?: (invoice: EInvoice) => (action: EInvoiceAction) => ReactNode;
  sections?: (invoice: EInvoice) => ReactNode;
}) {
  return (
    <PermissionBoundary permissions={[EINVOICE_PERMISSIONS.viewPage]}>
      <EInvoiceDetailContent {...props} />
    </PermissionBoundary>
  );
}
