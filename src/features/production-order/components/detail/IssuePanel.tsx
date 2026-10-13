"use client";

import { useState } from "react";
import { LoaderCircle, ScanLine } from "lucide-react";

import { MATERIAL_ISSUE_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { productionErrorMessage } from "@/features/production-order/errors";
import { useIssueMaterial } from "@/features/production-order/mutations";
import { useMaterialIssues } from "@/features/production-order/queries";
import { blanksStillNeeded } from "@/features/production-order/selectors";
import { LocationField } from "@/components/backoffice/LocationField";
import { Card } from "@/components/shared/Card";
import { FORM_INPUT_CLASS, FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { MONO } from "../copy";

import type { ProductionDetail } from "@/features/production-order/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Xuất phôi cho LSX (SCRUM-410): cần xuất vs đã xuất; mỗi lần quét chuyển trọn một phiếu giữ phôi
 * tới khu sản xuất. `requestId` sinh một lần cho mỗi lượt → bấm lại không xuất trùng (BE idempotent).
 * BE không có tra cứu theo mã vạch → ô "phiếu giữ" để trống thì hệ thống lấy phiếu kế tiếp.
 */
export function IssuePanel({ order, active }: { order: ProductionDetail; active: boolean }) {
  const canRead = useCan(MATERIAL_ISSUE_PERMISSIONS.read);
  const canIssue = useCan(MATERIAL_ISSUE_PERMISSIONS.create);
  const issues = useMaterialIssues(order.summary.id, canRead);
  const issue = useIssueMaterial();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [toLocation, setToLocation] = useState("");
  const [reservationId, setReservationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const needed = blanksStillNeeded(order);
  const reservationInvalid = reservationId !== "" && !UUID.test(reservationId);

  const submit = () => {
    setError(null);
    issue.mutate(
      { id: order.summary.id, requestId, toLocation, reservationId: reservationId || undefined },
      {
        onSuccess: () => {
          setRequestId(crypto.randomUUID());
          setReservationId("");
        },
        onError: (failure) => setError(productionErrorMessage(failure)),
      },
    );
  };

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-ink-primary text-sm font-semibold">Xuất phôi</h2>
        <span className={`text-ink-secondary ${MONO}`}>
          Đã xuất {formatNumber(order.issuedQuantity)} · còn cần {formatNumber(needed)} / KH{" "}
          {formatNumber(order.summary.plannedQuantity)}
        </span>
      </div>
      {active && canIssue && (
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (toLocation && !reservationInvalid && !issue.isPending) submit();
          }}
        >
          <LocationField
            id="issue-to"
            label="Khu sản xuất nhận phôi"
            warehouseId={order.summary.warehouseId}
            areaType="PRODUCTION"
            value={toLocation}
            onChange={setToLocation}
            required
            autoFocus
          />
          <FormField
            id="issue-reservation"
            label="Phiếu giữ phôi (quét, tuỳ chọn)"
            error={reservationInvalid ? "Mã phiếu giữ không hợp lệ" : undefined}
          >
            <Input
              id="issue-reservation"
              value={reservationId}
              onChange={(event) => setReservationId(event.target.value.trim())}
              className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)]`}
            />
          </FormField>
          <Button type="submit" disabled={!toLocation || reservationInvalid || issue.isPending}>
            {issue.isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ScanLine className="size-4" />
            )}{" "}
            Xuất phôi
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-danger text-[0.8125rem]">
          {error}
        </p>
      )}
      {!canRead && (
        <p className="text-ink-tertiary text-[0.8125rem]">Bạn chưa có quyền xem phiếu xuất phôi.</p>
      )}
      {issues.data && issues.data.length > 0 && (
        <table className="w-full text-[0.8125rem]">
          <caption className="sr-only">Các lần xuất phôi</caption>
          <thead className="text-ink-tertiary text-left">
            <tr>
              <th scope="col" className="py-1">
                Thời điểm
              </th>
              <th scope="col">Phôi / lô</th>
              <th scope="col">Từ → tới</th>
              <th scope="col" className="text-right">
                SL
              </th>
            </tr>
          </thead>
          <tbody>
            {issues.data.map((row) => (
              <tr key={row.id} className="border-border-default border-t">
                <td className="py-1 tabular-nums">{formatDateTime(row.issuedAt)}</td>
                <td className={MONO}>
                  {row.sku}
                  {row.lotNumber ? ` · ${row.lotNumber}` : ""}
                </td>
                <td className={MONO}>
                  {row.fromLocation} → {row.toLocation}
                </td>
                <td className={`text-right ${MONO}`}>{formatNumber(row.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {issues.data?.length === 0 && (
        <p className="text-ink-tertiary text-[0.8125rem]">Chưa xuất phôi lần nào.</p>
      )}
    </Card>
  );
}
