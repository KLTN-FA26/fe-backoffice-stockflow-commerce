"use client";

import { useRef, useState } from "react";
import { LoaderCircle, ScanLine } from "lucide-react";

import { ApiError } from "@/lib/api/error";
import { productionErrorMessage } from "@/features/production-order/errors";
import { useIssueMaterial } from "@/features/production-order/mutations";
import { scanMismatch } from "@/features/production-order/selectors";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { RefObject } from "react";
import type {
  MaterialIssue,
  PendingHold,
  ProductionDetail,
} from "@/features/production-order/types";

const SCAN_CLASS = `${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)] uppercase`;
const MISMATCH = {
  location: "Sai vị trí: phôi của phiếu giữ này không nằm ở vị trí vừa quét.",
  item: "Sai mã hàng: mã vừa quét không phải phôi của phiếu giữ này.",
} as const;

/**
 * Một lần quét xuất phôi (SCRUM-410): quét vị trí nguồn → quét SKU / mã vạch → xuất phiếu
 * giữ đang chọn. Máy quét gửi Enter sau mỗi mã: Enter ở ô vị trí chuyển sang ô mã, Enter ở ô mã thì xuất.
 * Không cập nhật tồn ở client: chỉ hiện kết quả BE trả về, rồi tải lại danh sách còn phải quét.
 */
export function IssueScanForm({
  order,
  toLocation,
  hold,
  onIssued,
}: {
  order: ProductionDetail;
  /** Khu sản xuất nhận phôi (chọn một lần cho cả lượt quét, ở panel). */
  toLocation: string;
  /** null = chưa giữ phôi nào: BE giữ và xuất phiếu kế tiếp, không có vị trí nguồn để quét. */
  hold: PendingHold | null;
  onIssued: (issue: MaterialIssue) => void;
}) {
  const issue = useIssueMaterial();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [scannedLocation, setScannedLocation] = useState("");
  const [scannedCode, setScannedCode] = useState("");
  const [fieldError, setFieldError] = useState<keyof typeof MISMATCH | null>(null);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const local = hold ? scanMismatch(hold, scannedLocation, scannedCode) : null;
  const shown = local ?? fieldError;
  const scansDone = !hold || (!!scannedLocation.trim() && !!scannedCode.trim());
  const ready = !!toLocation && scansDone && !local && !issue.isPending;

  const submit = () => {
    if (!ready) return;
    setError(null);
    setFieldError(null);
    issue.mutate(
      {
        id: order.summary.id,
        requestId,
        toLocation,
        ...(hold
          ? { reservationId: hold.reservationId, scannedLocation, scannedCode: scannedCode.trim() }
          : {}),
      },
      {
        onSuccess: (result) => {
          // Panel đổi `key` theo phiếu kế tiếp → form mới, ô quét vị trí tự focus.
          setRequestId(crypto.randomUUID());
          setScannedLocation("");
          setScannedCode("");
          onIssued(result.issue);
        },
        onError: (failure) => {
          const code = failure instanceof ApiError ? failure.code : "";
          if (code === "ISSUE_LOCATION_MISMATCH") setFieldError("location");
          else if (code === "ISSUE_ITEM_MISMATCH") setFieldError("item");
          else setError(productionErrorMessage(failure));
        },
      },
    );
  };

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {hold ? (
        <>
          <ScanField
            id="issue-from"
            label={`Quét vị trí nguồn (${hold.locationCode})`}
            error={shown === "location" ? MISMATCH.location : undefined}
            value={scannedLocation}
            onChange={(value) => {
              setFieldError(null);
              setScannedLocation(value);
            }}
            onEnter={() => codeRef.current?.focus()}
            autoFocus
          />
          <ScanField
            id="issue-code"
            inputRef={codeRef}
            label={`Quét SKU / mã vạch (${hold.sku})`}
            error={shown === "item" ? MISMATCH.item : undefined}
            value={scannedCode}
            onChange={(value) => {
              setFieldError(null);
              setScannedCode(value);
            }}
          />
        </>
      ) : (
        <p className="text-ink-secondary self-end text-[0.8125rem]">
          Chưa có phiếu giữ phôi nào — lần xuất tới sẽ giữ phôi trong kho của lệnh rồi chuyển.
        </p>
      )}
      <div className="flex items-end justify-end">
        <Button type="submit" disabled={!ready}>
          {issue.isPending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <ScanLine className="size-4" />
          )}{" "}
          Xuất phôi
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-danger text-[0.8125rem] sm:col-span-2">
          {error}
        </p>
      )}
    </form>
  );
}

/** Ô quét (máy quét gửi chuỗi + Enter). `onEnter` có thì Enter chuyển ô thay vì gửi form. */
function ScanField({
  id,
  label,
  error,
  value,
  onChange,
  onEnter,
  inputRef,
  autoFocus,
}: {
  id: string;
  label: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
}) {
  return (
    <FormField id={id} label={label} required error={error}>
      <Input
        ref={inputRef}
        autoFocus={autoFocus}
        {...fieldA11y(id, error)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || !onEnter) return;
          event.preventDefault();
          onEnter();
        }}
        className={SCAN_CLASS}
      />
    </FormField>
  );
}
