"use client";

import Link from "next/link";
import { Info, MapPin } from "lucide-react";

import { ADMIN_ROUTES, CARTON_LIST_LABELS as L } from "@/constants";
import { formatDateTime, formatNumber } from "@/lib/format";

import { cartonLocationHref } from "@/features/inventory/carton-selectors";
import { returnOwnershipBadge } from "@/features/inventory/quarantine-lifecycle";

import { DetailSection, InfoRow } from "@/components/shared/DetailSection";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { packageStatusDisplay, sourceText } from "../carton-cells";

import type { CartonDetail } from "@/features/inventory/quarantine-types";

const D = L.detail;
const H = L.column;
const NONE = "—";
const mono = (text: string) => <span className="font-[family-name:var(--font-mono)]">{text}</span>;

/** Thông tin chung của một thùng (BE `StockPackageDetailResponse`, #454): hàng, kho / vị trí, số lượng, nguồn gốc. */
export function CartonInfo({ carton }: { carton: CartonDetail }) {
  const locationHref = cartonLocationHref(carton.warehouseCode, carton.locationCode);
  const ownership = returnOwnershipBadge(carton);
  return (
    <DetailSection
      title={D.general}
      icon={Info}
      actions={
        locationHref && (
          <Button asChild size="sm" variant="outline">
            <Link href={locationHref}>
              <MapPin className="size-3.5" aria-hidden /> {D.viewLocation}
            </Link>
          </Button>
        )
      }
    >
      <div className="divide-y divide-(--table-line)">
        <InfoRow label={D.product}>{carton.productName ?? NONE}</InfoRow>
        <InfoRow label={D.variant}>{carton.variantName ?? NONE}</InfoRow>
        <InfoRow label={D.sku}>{mono(carton.sku)}</InfoRow>
        <InfoRow label={`${H.warehouse} · ${H.location}`}>
          {mono(`${carton.warehouseCode ?? NONE} · ${carton.locationCode ?? NONE}`)}
        </InfoRow>
        <InfoRow label={H.lot}>{carton.lotNumber ? mono(carton.lotNumber) : NONE}</InfoRow>
        <InfoRow label={H.status}>
          <StatusDot domain="stock" status={packageStatusDisplay(carton.status)} />
        </InfoRow>
        <InfoRow label={D.unit}>{carton.unitOfMeasure ?? NONE}</InfoRow>
        <InfoRow label={`${D.onHand} / ${D.received} / ${D.nominal}`}>
          <span className="tabular-nums">
            {formatNumber(carton.onHand)} /{" "}
            {carton.receivedQty == null ? NONE : formatNumber(carton.receivedQty)} /{" "}
            {formatNumber(carton.nominalQty)}
          </span>
        </InfoRow>
        <InfoRow label={D.reserved}>{formatNumber(carton.reserved)}</InfoRow>
        <InfoRow label={H.receivedAt}>
          {carton.receivedAt ? formatDateTime(carton.receivedAt) : NONE}
        </InfoRow>
        <InfoRow label={H.source}>
          {carton.source ? sourceText(carton.source) : NONE}
          {carton.goodsReceiptId && carton.goodsReceiptNumber && (
            <>
              {" · "}
              <Link
                href={ADMIN_ROUTES.receipts.detail(carton.goodsReceiptId)}
                className="text-accent-text hover:underline"
              >
                {D.receipt} {carton.goodsReceiptNumber}
              </Link>
            </>
          )}
        </InfoRow>
        {carton.closedAt && <InfoRow label={D.closedAt}>{formatDateTime(carton.closedAt)}</InfoRow>}
        {ownership && <InfoRow label={D.returnOwnership}>{ownership}</InfoRow>}
        {carton.openedOnReturn && <InfoRow label={D.returnRma}>{D.openedOnReturn}</InfoRow>}
      </div>
    </DetailSection>
  );
}
