"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";

import { ORDER_DELIVERY_DOCUMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import { getDeliveryDocumentLink } from "../delivery-documents-api";
import { useOrderDeliveryDocuments } from "../delivery-documents-queries";

import type { DeliveryDocument, DeliveryDocumentKind } from "../delivery-documents-api";

const D = UI_LABELS.shipping.afterHandover.documents;

function FileRow({
  file,
  pending,
  onDownload,
}: {
  file: DeliveryDocument;
  pending: boolean;
  onDownload: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-ink-primary min-w-0 truncate">{file.fileName}</span>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={onDownload}
        aria-label={`${D.download} ${file.fileName}`}
      >
        <Download className="size-3.5" /> {D.download}
      </Button>
    </li>
  );
}

/**
 * File vận đơn và biên bản giao nhận (POD) của đơn để Sale gửi khách khi khách xin qua chat (docs 09 §2, §7 dòng 16).
 * Chỉ hiện khi có quyền `fulfillment-delivery-documents:READ` — UI-only, Backend phải re-check; khách không thấy (BR-05).
 * Link tải lấy mỗi lần bấm, không lưu.
 */
export function OrderDeliveryDocuments({ orderId }: { orderId: string }) {
  const canRead = useCan(ORDER_DELIVERY_DOCUMENT_PERMISSIONS.read);
  const query = useOrderDeliveryDocuments(orderId, { enabled: canRead });
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!canRead || query.isPending) return null;

  const download = async (kind: DeliveryDocumentKind, fileId: string) => {
    setError(null);
    setOpening(fileId);
    try {
      window.open(
        await getDeliveryDocumentLink(orderId, kind, fileId),
        "_blank",
        "noopener,noreferrer",
      );
    } catch {
      setError(D.downloadFailed);
    } finally {
      setOpening(null);
    }
  };
  const shipments = query.data ?? [];
  const hasFiles = shipments.some(
    (s) => s.podFiles.length > 0 || s.vehicles.some((v) => v.waybillFiles.length > 0),
  );

  return (
    <section
      aria-label={D.title}
      className="border-border-default bg-bg-surface space-y-3 rounded-[var(--card-radius)] border p-[var(--card-pad)] text-[0.8125rem]"
    >
      <h2 className="text-ink-primary flex items-center gap-2 text-[0.9375rem] font-semibold">
        <FileText className="text-accent size-4" />
        {D.title}
      </h2>
      <p className="text-ink-tertiary text-xs">{D.hint}</p>
      {query.isError && <Alert tone="danger">{D.loadFailed}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {!query.isError && !hasFiles && <p className="text-ink-tertiary">{D.empty}</p>}
      {hasFiles && (
        <ul className="space-y-3">
          {shipments.map((s) => (
            <li key={s.shipmentId} className="space-y-1.5">
              <p className="text-ink-secondary font-medium">
                {D.shipment} <span className="font-mono">{s.shipmentCode}</span>
              </p>
              <p className="text-ink-tertiary text-xs">{D.pod}</p>
              {s.podFiles.length === 0 ? (
                <p className="text-ink-tertiary text-xs">{D.noPod}</p>
              ) : (
                <ul className="space-y-1">
                  {s.podFiles.map((f) => (
                    <FileRow
                      key={f.fileId}
                      file={f}
                      pending={opening === f.fileId}
                      onDownload={() => void download("pod-files", f.fileId)}
                    />
                  ))}
                </ul>
              )}
              {s.vehicles.map((v) => (
                <div key={v.loadId} className="space-y-1">
                  <p className="text-ink-tertiary text-xs">
                    {D.waybillFile} · {D.vehicle} <span className="font-mono">{v.loadCode}</span>
                    {v.waybillNo ? ` · ${D.waybillNo} ${v.waybillNo}` : ""}
                  </p>
                  {v.waybillFiles.length === 0 ? (
                    <p className="text-ink-tertiary text-xs">{D.noWaybillFile}</p>
                  ) : (
                    <ul className="space-y-1">
                      {v.waybillFiles.map((f) => (
                        <FileRow
                          key={f.fileId}
                          file={f}
                          pending={opening === f.fileId}
                          onDownload={() => void download("waybill-files", f.fileId)}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
