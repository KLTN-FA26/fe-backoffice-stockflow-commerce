"use client";

import { useState } from "react";
import { FileDown, LoaderCircle } from "lucide-react";

import { openBlob, openLink } from "@/lib/files/open-blob";
import { Button } from "@/components/ui/button";

import { getContractLink, getContractPreview } from "../../sales-contract-api";

import type { SalesContract } from "../../sales-contract-schemas";

type Download = "preview" | "document" | "signed";

/**
 * Xem trước PDF nháp (`/preview`), tải bản đã gửi (`/document`), tải bản đã ký (`/signed-file`). Trong lúc BE dựng
 * PDF, nút đang chạy quay vòng và cả nhóm khoá lại — không bấm chồng nhiều lần (BO-UX-31).
 */
export function ContractDownloads({
  contract,
  canPreview,
  onError,
}: {
  contract: SalesContract;
  canPreview: boolean;
  onError: (error: unknown) => void;
}) {
  const [busy, setBusy] = useState<Download | null>(null);
  const run = async (kind: Download, load: () => Promise<void>) => {
    setBusy(kind);
    try {
      await load();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(null);
    }
  };
  const sent =
    contract.status === "SENT" || contract.status === "SIGNED" || contract.status === "COMPLETED";
  const icon = (kind: Download) =>
    busy === kind ? (
      <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
    ) : (
      <FileDown className="size-3.5" aria-hidden="true" />
    );
  return (
    <>
      {canPreview && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          aria-busy={busy === "preview" || undefined}
          onClick={() =>
            void run("preview", async () =>
              openBlob(
                await getContractPreview(contract.orderId),
                `${contract.contractNumber}.pdf`,
              ),
            )
          }
        >
          {icon("preview")} Xem trước PDF
        </Button>
      )}
      {sent && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          aria-busy={busy === "document" || undefined}
          onClick={() =>
            void run("document", async () =>
              openLink((await getContractLink(contract.orderId, "document")).url),
            )
          }
        >
          {icon("document")} Tải hợp đồng đã gửi
        </Button>
      )}
      {contract.signedFileName && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          aria-busy={busy === "signed" || undefined}
          onClick={() =>
            void run("signed", async () =>
              openLink((await getContractLink(contract.orderId, "signed-file")).url),
            )
          }
        >
          {icon("signed")} Tải bản đã ký
        </Button>
      )}
    </>
  );
}
