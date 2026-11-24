"use client";

import { useState } from "react";

import { EINVOICE_PERMISSIONS } from "@/constants/einvoice";
import { EINVOICE_LABELS, SIGNATURE_STATUS_LABELS } from "@/constants/labels-einvoice";
import { useCan } from "@/lib/auth/components/Can";
import { formatDateTime } from "@/lib/format/date";
import { Card } from "@/components/shared/Card";
import { FilePickerField } from "@/components/shared/FilePickerField";
import { FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";

import { einvoiceErrorMessage } from "../errors";
import { useCheckSignature } from "../mutations";
import { useSignature } from "../queries";

import { InfoRow } from "./primitives";

import type { EInvoiceSignature } from "../types";

const GRID = "grid grid-cols-[minmax(140px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]";
const yesNo = (value: boolean | null | undefined) => (value == null ? "—" : value ? "Có" : "Không");

function SignatureResult({ signature }: { signature: EInvoiceSignature }) {
  return (
    <dl className={GRID}>
      <InfoRow label="Kết quả">
        <span className={signature.valid ? "font-medium" : "text-danger font-medium"}>
          {SIGNATURE_STATUS_LABELS[signature.status]}
        </span>
      </InfoRow>
      <InfoRow label="Người ký">
        {signature.signer ?? "—"}
        {signature.signerTaxCode ? ` (MST ${signature.signerTaxCode})` : ""}
      </InfoRow>
      {signature.issuer && <InfoRow label="Tổ chức cấp chứng thư">{signature.issuer}</InfoRow>}
      {signature.signingTime && (
        <InfoRow label="Ký lúc">{formatDateTime(signature.signingTime)}</InfoRow>
      )}
      <InfoRow label="Chứng thư còn hiệu lực khi ký">
        {yesNo(signature.certificateValidAtSigning)}
      </InfoRow>
      <InfoRow label="Bên mua ký">{yesNo(signature.buyerSigned)}</InfoRow>
      {signature.chainChecked === false && (
        <InfoRow label="Lưu ý">
          Chưa đối chiếu chứng thư với tổ chức chứng thực; mã của cơ quan thuế cho biết cơ quan thuế
          đã nhận hoá đơn.
        </InfoRow>
      )}
    </dl>
  );
}

/**
 * Chữ ký số của bên bán trên XML (BO-09; BE `GET /einvoices/{id}/signature`, `POST /einvoices/signature-checks`):
 * Kế toán kiểm khi cảnh báo SIGNATURE_INVALID báo, hoặc kiểm một tệp XML bất kỳ (bản khách gửi lại). Chỉ gọi khi bấm —
 * mỗi lần kiểm phải tải XML từ kho lưu trữ.
 */
export function SignatureCard({ id }: { id: string }) {
  const canRead = useCan(EINVOICE_PERMISSIONS.read);
  const [asked, setAsked] = useState(false);
  const own = useSignature(id, asked && canRead);
  const check = useCheckSignature();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!canRead) return null;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-ink-primary text-sm font-semibold">
          {EINVOICE_LABELS.detail.signature}
        </h2>
        <Button
          size="sm"
          variant="outline"
          disabled={own.isFetching}
          onClick={() => (asked ? void own.refetch() : setAsked(true))}
        >
          Kiểm tra chữ ký số
        </Button>
      </div>
      {asked && own.isPending && <p className="text-ink-tertiary text-[0.8125rem]">Đang kiểm…</p>}
      {own.isError && (
        <p role="alert" className="text-danger text-[0.8125rem]">
          {einvoiceErrorMessage(own.error)}
        </p>
      )}
      {own.data && <SignatureResult signature={own.data} />}
      <div className="border-border-default space-y-2 border-t pt-3">
        <p className="text-ink-secondary text-[0.8125rem]">
          Kiểm một tệp XML khác (bản khách gửi lại, bản nghi bị sửa) — hệ thống không lưu tệp.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <FormField id="signature-check-file" label="Tệp XML cần kiểm">
            <FilePickerField
              id="signature-check-file"
              accept=".xml,application/xml,text/xml"
              fileName={file?.name}
              onChange={setFile}
            />
          </FormField>
          <Button
            size="sm"
            variant="outline"
            disabled={!file || check.isPending}
            onClick={() => {
              if (!file) return;
              setError(null);
              check.mutate(file, { onError: (failure) => setError(einvoiceErrorMessage(failure)) });
            }}
          >
            Kiểm tệp
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-danger text-[0.8125rem]">
            {error}
          </p>
        )}
        {check.data && <SignatureResult signature={check.data} />}
      </div>
    </Card>
  );
}
