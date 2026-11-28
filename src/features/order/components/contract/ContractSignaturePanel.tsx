"use client";

import { CONTRACT_ESIGN_LABELS as L } from "@/constants/contract-esign";

import { formatDateTime } from "@/lib/format/date";

import { Notice } from "@/components/shared/Notice";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot as StatusBadge } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { useContractSignatures } from "../../sales-contract-esign-queries";
import { formatContractVerificationCode } from "../../sales-contract-esign-rules";

import type { ContractInspection } from "../../sales-contract-esign-schemas";

export function ContractInspectionBadges({ inspection }: { inspection: ContractInspection }) {
  if (inspection.kind !== "DIGITAL" && inspection.kind !== "SCAN")
    return <StatusBadge domain="order" status="Rejected" label="Không đọc được chữ ký số" />;
  return (
    <div className="flex flex-wrap gap-2">
      {inspection.kind === "SCAN" && <StatusBadge domain="order" status="Draft" label={L.scan} />}
      {inspection.kind === "DIGITAL" && inspection.valid && (
        <StatusBadge domain="order" status="Approved" label={L.valid} />
      )}
      {inspection.kind === "DIGITAL" && inspection.valid === false && (
        <StatusBadge domain="order" status="Rejected" label="Chữ ký số không hợp lệ" />
      )}
      {inspection.matchesSentDocument && (
        <StatusBadge domain="order" status="Approved" label={L.matches} />
      )}
      {inspection.kind === "DIGITAL" && inspection.matchesSentDocument === false && (
        <StatusBadge domain="order" status="Rejected" label="Không khớp bản đã gửi" />
      )}
      {inspection.kind === "DIGITAL" && inspection.coversWholeDocument === false && (
        <StatusBadge domain="order" status="Rejected" label="Chữ ký không phủ toàn bộ tài liệu" />
      )}
      {inspection.chainChecked === false && (
        <StatusBadge domain="order" status="Pending Approval" label={L.chain} />
      )}
    </div>
  );
}
export function ContractSignaturePanel({ orderId }: { orderId: string }) {
  const query = useContractSignatures(orderId);
  if (query.data === null) return null;
  if (query.isPending) return <Skeleton className="h-16 w-full" />;
  if (query.isError)
    return (
      <Notice tone="warning">
        Không tải được chữ ký.{" "}
        <Button variant="link" size="sm" onClick={() => void query.refetch()}>
          Thử lại
        </Button>
      </Notice>
    );
  const view = query.data;
  return (
    <section aria-label={L.signatures} className="border-border-default space-y-3 border-t pt-3">
      <h3 className="text-ink-primary text-sm font-semibold">{L.signatures}</h3>
      {!view.customer && !view.company && (
        <p className="text-ink-secondary text-xs">Chưa ghi nhận chữ ký.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["customer", "Bên mua"],
            ["company", "Bên bán"],
          ] as const
        ).map(([key, label]) => {
          const party = view[key];
          return (
            party && (
              <div key={key} className="text-ink-secondary min-w-0 space-y-2 text-xs">
                <h4 className="text-ink-primary font-medium">{label}</h4>
                <p>
                  {party.signerName} · {party.signerTitle}
                </p>
                {party.signedAt && <p>{formatDateTime(party.signedAt)}</p>}
                {party.email && <p className="break-all">{party.email}</p>}
                {party.ip && <p>Địa chỉ IP: {party.ip}</p>}
                {party.otpVerified && <p>Đã xác minh mã OTP</p>}
                {party.certificateSubject && (
                  <p className="break-words">Chủ thể chứng thư: {party.certificateSubject}</p>
                )}
                {party.certificateIssuer && (
                  <p className="break-words">Nơi cấp: {party.certificateIssuer}</p>
                )}
                {party.testCertificate && (
                  <>
                    <StatusBadge domain="order" status="Pending Approval" label={L.test} />
                    <Notice tone="warning">{L.testWarning}</Notice>
                  </>
                )}
                {party.inspection && (
                  <>
                    <ContractInspectionBadges inspection={party.inspection} />
                    {party.inspection.signers?.map((signer, index) => (
                      <div key={signer.serial ?? index} className="break-words">
                        <p>
                          {signer.subject} · {signer.issuer}
                        </p>
                        {signer.notAfter && (
                          <p>Chứng thư hết hạn: {formatDateTime(signer.notAfter)}</p>
                        )}
                        {signer.certificateValidAtSigning != null && (
                          <p>
                            {signer.certificateValidAtSigning
                              ? "Chứng thư còn hiệu lực tại thời điểm ký"
                              : "Chứng thư không còn hiệu lực tại thời điểm ký"}
                          </p>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )
          );
        })}
      </div>
      {view.documentSha256 && (
        <p className="text-ink-secondary text-xs break-all">SHA-256: {view.documentSha256}</p>
      )}
      {view.verificationCode && (
        <p className="text-ink-secondary text-xs">
          Mã xác minh: {formatContractVerificationCode(view.verificationCode)}
        </p>
      )}
    </section>
  );
}
