"use client";

import { useState } from "react";

import { STOCK_PACKAGE_PERMISSIONS } from "@/constants/permissions";
import {
  CUSTOMER_CUSTODY_OWNERSHIP_LABELS,
  RETURN_CUSTODY_CHOICE_LABELS,
  RETURN_LABELS,
} from "@/constants/labels-return";
import { RETURN_LIMITS } from "@/constants/returns";
import { usePermissionChecker } from "@/lib/auth/components/Can";
import { formatDateTime } from "@/lib/format/date";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import { custodyChoiceErrorMessage } from "../errors";
import { useEndCustomerCustody } from "../mutations";
import { useCustomerCustody } from "../queries";

import { MONO } from "./primitives";

import type { CustomerCustodyCarton, HeldCarton } from "../types";

const C = RETURN_LABELS.detail.custodyChoice;

/** Những gì một dòng thùng giữ hộ cần — chung cho danh sách của kho và `custodyCartons` trên chi tiết yêu cầu. */
type CartonRow = Pick<
  CustomerCustodyCarton | HeldCarton,
  "lpn" | "sku" | "quantity" | "locationCode" | "ownership" | "choice" | "endedAt"
>;

/**
 * Các dòng thùng giữ hộ, với nút "Đã thực hiện" của Quản lý kho (`inventory-stock-packages:UPDATE`) cho thùng Sale đã ghi
 * lựa chọn mà kho chưa làm (BE `POST /inventory/stock-packages/{lpn}/customer-custody/end`, biên bản bắt buộc).
 */
export function HeldCartonList({
  cartons,
  empty = C.noCartons,
}: {
  cartons: readonly CartonRow[];
  empty?: string;
}) {
  const can = usePermissionChecker();
  const canEnd = can(STOCK_PACKAGE_PERMISSIONS.update);
  const [ending, setEnding] = useState<CartonRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const end = useEndCustomerCustody();
  const close = () => {
    setEnding(null);
    setError(null);
  };
  if (cartons.length === 0) return <p className="text-ink-tertiary text-[0.8125rem]">{empty}</p>;
  return (
    <>
      <ul className="divide-y divide-[var(--table-line)] text-[0.8125rem]">
        {cartons.map((carton) => (
          <li
            key={carton.lpn}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5"
          >
            <span className={MONO}>{carton.lpn}</span>
            <span className="text-ink-secondary">
              {carton.sku ?? ""} × {carton.quantity.toLocaleString("vi-VN")}
              {carton.locationCode ? ` · ${carton.locationCode}` : ""}
            </span>
            <span className="text-ink-secondary">
              {CUSTOMER_CUSTODY_OWNERSHIP_LABELS[carton.ownership] ?? carton.ownership}
              {" · "}
              {carton.choice ? RETURN_CUSTODY_CHOICE_LABELS[carton.choice] : C.waitChoice}
            </span>
            {carton.endedAt ? (
              <span className="text-ink-tertiary">{C.ended(formatDateTime(carton.endedAt))}</span>
            ) : (
              canEnd &&
              carton.choice && (
                <Button size="sm" variant="outline" onClick={() => setEnding(carton)}>
                  {C.end}
                </Button>
              )
            )}
          </li>
        ))}
      </ul>
      {ending && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && close()}
          title={C.endTitle}
          description={C.endDescription(
            ending.lpn,
            ending.choice ? RETURN_CUSTODY_CHOICE_LABELS[ending.choice] : "",
          )}
          confirmLabel={C.end}
          requireReason
          reasonLabel={C.endNote}
          reasonMaxLength={RETURN_LIMITS.reasonMax}
          closeOnConfirm={false}
          loading={end.isPending}
          error={error}
          onConfirm={(note) =>
            end.mutate(
              { lpn: ending.lpn, note: note ?? "" },
              {
                onSuccess: close,
                onError: (failure) => setError(custodyChoiceErrorMessage(failure)),
              },
            )
          }
        />
      )}
    </>
  );
}

/**
 * Thùng giữ hộ khách của cả kho (WF-05 Q-4 / TH-6, audit r2 returns H1; BE `GET /inventory/stock-packages/customer-custody`):
 * ngoài sổ kho, đứng ở khu cách ly. Quản lý kho ghi "Đã thực hiện" khi đã giao trả / huỷ hộ đúng lựa chọn khách — chỉ khi
 * Sale đã ghi lựa chọn (`choice`). Cần `inventory-stock-packages:READ`; không có → không hiện. Trên chi tiết một yêu cầu,
 * thùng lấy từ `custodyCartons` của BE (`ReturnCustodyChoiceCard`, audit r3 RAD-3) — Sale không cần quyền kho để thấy.
 */
export function CustomerCustodyCartons({ title = C.cartons }: { title?: string }) {
  const can = usePermissionChecker();
  const canRead = can(STOCK_PACKAGE_PERMISSIONS.read);
  const query = useCustomerCustody({ ended: false }, canRead);
  if (!canRead) return null;
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="text-ink-primary text-[0.8125rem] font-semibold">{title}</h3>
      {query.isError ? (
        <p role="alert" className="text-danger text-xs">
          {C.cartonsError}
        </p>
      ) : query.isPending ? null : (
        <HeldCartonList cartons={query.data.items} />
      )}
    </section>
  );
}
