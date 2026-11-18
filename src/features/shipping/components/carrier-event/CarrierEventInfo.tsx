"use client";

import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { formatCarrierEventPayload } from "@/features/shipping/carrier-event-payload";
import { formatDateTime } from "@/lib/format/date";
import { Alert } from "@/components/shared/Alert";

import { InfoItem } from "../primitives";
import { EventResult } from "./EventResult";

import type { CarrierEventDetail } from "@/features/shipping/carrier-event-types";

const D = UI_LABELS.shipping.carrierEvents.detail;
const E = UI_LABELS.shipping.carrierEvents;
const LINK = "text-accent hover:underline";

/** Chi tiết chỉ-đọc của một sự kiện: ai báo gì, ghép vào đâu, kết quả và nghĩa của nó, nội dung hãng gửi, người đã xử lý. */
export function CarrierEventInfo({
  detail,
  canLink,
  showGuide,
}: {
  detail: CarrierEventDetail;
  canLink: boolean;
  /** Hướng dẫn xử lý tay: chỉ cho người đánh dấu được sự kiện này. */
  showGuide: boolean;
}) {
  const event = detail.event;
  const payload = formatCarrierEventPayload(detail.payload);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <InfoItem label={D.carrier} value={event.carrierCode ?? D.none} mono />
        <InfoItem label={D.source} value={E.source[event.source]} />
        <InfoItem label={D.received} value={formatDateTime(event.receivedAt)} />
        <InfoItem
          label={D.reported}
          value={event.carrierReportedAt ? formatDateTime(event.carrierReportedAt) : D.none}
        />
        <InfoItem label={D.kind} value={event.kind ? E.kind[event.kind] : D.none} />
        <InfoItem label={D.reference} value={event.carrierReference ?? D.none} mono />
        <InfoItem
          label={D.load}
          value={
            event.loadCode && canLink && event.loadId ? (
              <Link
                href={ADMIN_ROUTES.loads.detail(event.loadId)}
                className={LINK}
                aria-label={`${D.openLoad} ${event.loadCode}`}
              >
                {event.loadCode}
              </Link>
            ) : (
              (event.loadCode ?? D.none)
            )
          }
          mono
        />
        <InfoItem
          label={D.shipment}
          value={
            event.shipmentCode && canLink && event.shipmentId ? (
              <Link
                href={ADMIN_ROUTES.shipments.detail(event.shipmentId)}
                className={LINK}
                aria-label={`${D.openShipment} ${event.shipmentCode}`}
              >
                {event.shipmentCode}
              </Link>
            ) : (
              (event.shipmentCode ?? D.none)
            )
          }
          mono
        />
        {event.source === "WEBHOOK" && (
          <InfoItem
            label={D.signature}
            value={event.signatureValid ? D.signatureOk : D.signatureBad}
          />
        )}
      </div>
      <section className="space-y-1.5">
        <h3 className="text-ink-secondary text-xs font-medium">{D.result}</h3>
        <EventResult result={event.result} />
        <p className="text-ink-secondary text-[0.8125rem]">{E.resultMeaning[event.result]}</p>
      </section>
      {showGuide && (
        <Alert tone="warning" title={E.guide.title}>
          {E.guide.text}
        </Alert>
      )}
      {event.resolvedAt && (
        <Alert tone="info" title={E.resolved.title}>
          <div className="space-y-0.5">
            <p>
              {E.resolved.by}: {event.resolvedByName ?? D.none} · {E.resolved.at}{" "}
              {formatDateTime(event.resolvedAt)}
            </p>
            {event.resolutionNote && (
              <p className="whitespace-pre-wrap">
                {E.resolved.note}: {event.resolutionNote}
              </p>
            )}
            <p>{E.resolved.never}</p>
          </div>
        </Alert>
      )}
      <section className="space-y-1.5">
        <h3 className="text-ink-secondary text-xs font-medium">{D.payload}</h3>
        <p className="text-ink-tertiary text-xs">{D.payloadHint}</p>
        {payload ? (
          <pre
            tabIndex={0}
            aria-label={D.payload}
            className="border-border-default bg-bg-subtle text-ink-primary max-h-52 overflow-auto rounded-[var(--r-sm)] border p-2.5 font-[family-name:var(--font-mono)] text-xs break-words whitespace-pre-wrap"
          >
            {payload}
          </pre>
        ) : (
          <p className="text-ink-tertiary text-[0.8125rem]">{D.payloadEmpty}</p>
        )}
      </section>
    </div>
  );
}
