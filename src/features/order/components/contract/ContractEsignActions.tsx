"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import { CONTRACT_ESIGN_LABELS as L } from "@/constants/contract-esign";

import { openLink } from "@/lib/files/open-blob";

import { Notice } from "@/components/shared/Notice";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { getContractEsignLink } from "../../sales-contract-esign-api";
import { contractEsignError } from "../../sales-contract-esign-queries";
import { contractEsignActions } from "../../sales-contract-esign-rules";

import { ContractEsignDialog } from "./ContractEsignDialog";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { ContractEsignAction } from "../../sales-contract-esign-api";
import type { SalesContract } from "../../sales-contract-schemas";

export function ContractEsignActions({
  contract,
  can,
  ownerBlocked,
}: {
  contract: SalesContract;
  can: (code: PermissionCode) => boolean;
  ownerBlocked: string | null;
}) {
  const [dialog, setDialog] = useState<ContractEsignAction | null>(null);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const actions = contractEsignActions(contract, can).filter(
    (action) => !unavailable.includes(action),
  );
  return (
    <div className="space-y-2">
      {contract.termsReviewDetail?.note && (
        <Notice tone="info">{contract.termsReviewDetail?.note}</Notice>
      )}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action}
            size="sm"
            variant={action === "companySign" || action === "review" ? "default" : "outline"}
            disabled={!!ownerBlocked && ["review", "withdraw", "extend"].includes(action)}
            title={
              ["review", "withdraw", "extend"].includes(action)
                ? (ownerBlocked ?? undefined)
                : undefined
            }
            onClick={() => setDialog(action)}
          >
            {L[action]}
          </Button>
        ))}
        {actions.includes("companySign") && !unavailable.includes("external") && (
          <Button
            size="sm"
            variant="outline"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              setDownloadError(null);
              try {
                const link = await getContractEsignLink(
                  contract.orderId,
                  "/company-signature/document",
                );
                if (link) openLink(link.url);
                else {
                  setUnavailable((items) => [...items, "external"]);
                  toast.warning(L.unavailable);
                }
              } catch (error: unknown) {
                setDownloadError(contractEsignError(error));
              } finally {
                setDownloading(false);
              }
            }}
          >
            {downloading && <LoaderCircle className="size-3.5 animate-spin" />}
            {L.external}
          </Button>
        )}
      </div>
      {downloadError && <Notice tone="danger">{downloadError}</Notice>}
      {dialog && (
        <ContractEsignDialog
          key={dialog}
          action={dialog}
          contract={contract}
          onClose={() => setDialog(null)}
          onUnavailable={() => {
            setUnavailable((items) => [...items, dialog]);
            setDialog(null);
            toast.warning(L.unavailable);
          }}
        />
      )}
    </div>
  );
}
