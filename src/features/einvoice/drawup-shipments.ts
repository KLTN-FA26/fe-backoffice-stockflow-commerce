/**
 * Các lô giao chọn được ở hộp "Lập hoá đơn nháp" (docs 21 BR-01: mỗi lô giao `Delivered` một hoá đơn gốc còn hiệu lực).
 * Gộp hai nguồn: hoá đơn của đơn (có mã lô, kể cả nháp đã huỷ) và các lô đã giao của đơn (còn lô mà nháp tự động chưa lập
 * được — BE `EInvoiceDraftFailed` — thì chưa có hoá đơn nào). Hàm thuần.
 */

import { EINVOICE_TYPES } from "@/constants/einvoice";
import { formatDate } from "@/lib/format/date";

import { einvoiceStatusLabel } from "./selectors";

import type { DeliveredShipmentRef } from "@/lib/references/order-delivered-shipments";
import type { EInvoiceListItem } from "./types";

/** Hoá đơn gốc của một lô giao. */
const [ORIGINAL] = EINVOICE_TYPES;

export interface ShipmentChoice {
  shipmentId: string;
  /** Mã lô `<mã đơn>-S<n>` khi đã có hoá đơn; null = lô chưa có hoá đơn nào. */
  code: string | null;
  /** Hoá đơn mang trạng thái nào (đã chọn theo `invoiceRank`); null = chưa có. */
  statusLabel: string | null;
  deliveredAt: string | null;
}

/** Nhỏ hơn = đại diện tốt hơn cho lô: hoá đơn gốc còn hiệu lực, rồi hoá đơn còn hiệu lực, rồi bản đã huỷ. */
function invoiceRank(item: EInvoiceListItem): number {
  const voided = item.status === "VOIDED_DRAFT";
  return (voided ? 2 : 0) + (item.type === ORIGINAL ? 0 : 1);
}

export function shipmentChoices(
  invoices: readonly EInvoiceListItem[],
  delivered: readonly DeliveredShipmentRef[],
): ShipmentChoice[] {
  const byShipment = new Map<string, EInvoiceListItem>();
  for (const item of invoices) {
    if (!item.shipmentId) continue;
    const known = byShipment.get(item.shipmentId);
    if (!known || invoiceRank(item) < invoiceRank(known)) byShipment.set(item.shipmentId, item);
  }
  const deliveredAt = new Map(delivered.map((ref) => [ref.shipmentId, ref.deliveredAt]));
  const invoiced = [...byShipment.entries()]
    .map(([shipmentId, item]) => ({
      shipmentId,
      code: item.shipmentCode ?? null,
      statusLabel: einvoiceStatusLabel(item.status),
      deliveredAt: deliveredAt.get(shipmentId) ?? null,
    }))
    .sort((a, b) => (a.code ?? "").localeCompare(b.code ?? "", "vi", { numeric: true }));
  const uninvoiced = delivered
    .filter((ref) => !byShipment.has(ref.shipmentId))
    .map((ref) => ({
      shipmentId: ref.shipmentId,
      code: null,
      statusLabel: null,
      deliveredAt: ref.deliveredAt,
    }))
    .sort((a, b) => (a.deliveredAt ?? "").localeCompare(b.deliveredAt ?? ""));
  return [...invoiced, ...uninvoiced];
}

/** Dòng hiện trong ô chọn. Lô không có mã thì gọi theo ngày giao, không bao giờ hiện id. */
export function shipmentChoiceLabel(
  choice: ShipmentChoice,
  text: {
    byDate: (date: string) => string;
    invoiceState: (status: string) => string;
    noInvoice: string;
  },
): string {
  const name =
    choice.code ?? text.byDate(choice.deliveredAt ? formatDate(choice.deliveredAt) : "—");
  const state = choice.statusLabel === null ? text.noInvoice : text.invoiceState(choice.statusLabel);
  return `${name} · ${state}`;
}
