"use client";

import { FileDown } from "lucide-react";

import { openBlob, openLink } from "@/lib/files/open-blob";
import { Button } from "@/components/ui/button";

import { getContractLink, getContractPreview } from "../../sales-contract-api";

import type { SalesContract } from "../../sales-contract-schemas";

/** Xem trước PDF nháp (`/preview`), tải bản đã gửi (`/document`), tải bản đã ký (`/signed-file`). */
export function ContractDownloads({
  contract,
  canPreview,
  onError,
}: {
  contract: SalesContract;
  canPreview: boolean;
  onError: (error: unknown) => void;
}) {
  const run = async (load: () => Promise<void>) => {
    try {
      await load();
    } catch (error) {
      onError(error);
    }
  };
  const sent =
    contract.status === "SENT" || contract.status === "SIGNED" || contract.status === "COMPLETED";
  return (
    <>
      {canPreview && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void run(async () =>
              openBlob(
                await getContractPreview(contract.orderId),
                `${contract.contractNumber}.pdf`,
              ),
            )
          }
        >
          <FileDown className="size-3.5" /> Xem trước PDF
        </Button>
      )}
      {sent && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void run(async () =>
              openLink((await getContractLink(contract.orderId, "document")).url),
            )
          }
        >
          <FileDown className="size-3.5" /> Tải hợp đồng đã gửi
        </Button>
      )}
      {contract.signedFileName && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void run(async () =>
              openLink((await getContractLink(contract.orderId, "signed-file")).url),
            )
          }
        >
          <FileDown className="size-3.5" /> Tải bản đã ký
        </Button>
      )}
    </>
  );
}
