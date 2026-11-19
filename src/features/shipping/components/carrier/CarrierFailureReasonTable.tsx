"use client";

import {
  CARRIER_CONFIG_LIMITS,
  ORDER_DELIVERY_FAILURE_LABELS,
  ORDER_DELIVERY_FAILURE_REASONS,
  UI_LABELS,
} from "@/constants";
import { newRowKey } from "@/features/shipping/carrier-row-core";

import { RemoveRowButton, RowsHead, RowsSection } from "./RowsSection";
import { SelectCell, TextCell } from "./RowCells";

import type { FailureReasonCode, FailureReasonRow } from "@/features/shipping/carrier-failure-rows";
import type { RowErrors } from "@/features/shipping/carrier-row-core";
import type { RowsEditor } from "./useRowsEditor";

const F = UI_LABELS.shipping.waybill.carriers.config.failureReasons;
const REASON_OPTIONS = ORDER_DELIVERY_FAILURE_REASONS.map((value) => ({
  value,
  label: ORDER_DELIVERY_FAILURE_LABELS[value],
}));
const isReason = (value: string): value is FailureReasonCode =>
  (ORDER_DELIVERY_FAILURE_REASONS as readonly string[]).includes(value);

/** Bảng ánh xạ lý do giao thất bại: lý do theo cách hãng nêu → một trong sáu mã lý do của hệ thống (docs 09 §4.1, E22). */
export function CarrierFailureReasonTable({
  editor,
  errors,
}: {
  editor: RowsEditor<FailureReasonRow>;
  errors: readonly RowErrors<"wording" | "reason">[];
}) {
  const { rows, setRows } = editor;
  const patch = (key: string, change: Partial<FailureReasonRow>) =>
    setRows(rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  return (
    <RowsSection
      id="carrier-failure-reasons"
      title={F.title}
      description={F.description}
      status={editor.status}
      onRetry={editor.retry}
      addLabel={F.add}
      onAdd={() => setRows([...rows, { key: newRowKey(), wording: "", reason: "" }])}
      isEmpty={rows.length === 0}
      emptyText={F.empty}
    >
      <table className="w-full table-fixed border-separate border-spacing-0">
        <RowsHead
          columns={[
            { label: F.wording, width: "w-[56%]" },
            { label: F.reason, width: "w-[38%]" },
          ]}
        />
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key}>
              <TextCell
                label={`${F.wording} ${index + 1}`}
                value={row.wording}
                placeholder={F.wordingPlaceholder}
                maxLength={CARRIER_CONFIG_LIMITS.failureReasonWordingMax}
                error={errors[index]?.wording}
                onChange={(wording) => patch(row.key, { wording })}
              />
              <SelectCell
                label={`${F.reason} ${index + 1}`}
                title={F.reason}
                value={row.reason}
                options={REASON_OPTIONS}
                placeholder={F.reasonPlaceholder}
                error={errors[index]?.reason}
                onChange={(next) => isReason(next) && patch(row.key, { reason: next })}
              />
              <td className="px-1 py-1 align-top">
                <RemoveRowButton
                  index={index}
                  onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </RowsSection>
  );
}
