"use client";

import { useState } from "react";

import { candidateByLpn, isWorkable } from "../receiving";

import { ReturnCandidateCartons } from "./ReturnCandidateCartons";
import { ReturnCartonScan } from "./ReturnCartonScan";
import { ReturnProgressCard } from "./ReturnProgressCard";

import type { RmaReceiving } from "../receiving";
import type { CandidateCarton, ReturnReceipt } from "../types";

/**
 * Vùng làm việc của phiếu nhập hàng hoàn theo yêu cầu trả hàng (WF-05 BE-22, Q-11): hàng được duyệt trả theo SKU, ô ghi
 * nhận (quét / gõ / chọn — một đường gửi) và các thùng có thể nhận. Thùng đang chọn đọc lại từ dữ liệu mới nhất sau mỗi
 * lần ghi: hết hợp lệ thì tự bỏ chọn, trần đếm luôn là số BE vừa trả.
 */
export function RmaReceivingPanel({
  receipt,
  progress,
  canScan,
}: {
  receipt: ReturnReceipt;
  progress: RmaReceiving;
  canScan: boolean;
}) {
  const [selectedLpn, setSelectedLpn] = useState<string | null>(null);
  const candidates = receipt.candidateCartons ?? [];
  const found = selectedLpn ? candidateByLpn(candidates, selectedLpn) : undefined;
  const selected = found && isWorkable(found) ? found : null;
  const draft = receipt.status === "DRAFT";
  return (
    <>
      <ReturnProgressCard progress={progress} draft={draft} />
      {canScan && (
        <ReturnCartonScan
          receiptId={receipt.id}
          expectedCartons={receipt.expectedCartons}
          candidates={candidates}
          selected={selected}
          onClearSelected={() => setSelectedLpn(null)}
        />
      )}
      {canScan && draft && (
        <ReturnCandidateCartons
          cartons={candidates}
          selectedLpn={selected?.lpn ?? null}
          disabled={false}
          onSelect={(carton: CandidateCarton) => setSelectedLpn(carton.lpn)}
        />
      )}
    </>
  );
}
