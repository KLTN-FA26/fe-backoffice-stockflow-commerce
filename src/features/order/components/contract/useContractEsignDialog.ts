"use client";

import { useEffect, useState } from "react";

import { CONTRACT_ESIGN_LIMITS as LIMITS } from "@/constants/contract-esign";

import { toLocalIsoDate } from "@/lib/format/date";

import { isContractUnavailable } from "../../sales-contract-esign-api";
import {
  contractEsignError,
  useCompanyCertificate,
  useUpdateContractEsign,
} from "../../sales-contract-esign-queries";
import { contractSignBySchema } from "../../sales-contract-esign-schemas";

import type { ContractEsignAction } from "../../sales-contract-esign-api";
import type { SalesContract } from "../../sales-contract-schemas";

export function useContractEsignDialog({
  action,
  contract,
  onClose,
  onUnavailable,
}: {
  action: ContractEsignAction;
  contract: SalesContract;
  onClose: () => void;
  onUnavailable: () => void;
}) {
  const mutation = useUpdateContractEsign();
  const signature = useCompanyCertificate(contract.orderId, action === "companySign");
  useEffect(() => {
    if (action === "companySign" && signature.data === null) onUnavailable();
  }, [action, signature.data, onUnavailable]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(
    contract.sellerSigner?.name ?? contract.seller.representative ?? "",
  );
  const [title, setTitle] = useState(
    contract.sellerSigner?.title ?? contract.seller.representativeTitle ?? "",
  );
  const [file, setFile] = useState<File | null>(null);
  const today = toLocalIsoDate(new Date().toISOString());
  const lastDate = new Date(`${today}T00:00:00Z`);
  lastDate.setUTCDate(lastDate.getUTCDate() + LIMITS.extendDays);
  const lastDay = lastDate.toISOString().slice(0, 10);
  const [signBy, setSignBy] = useState(contract.signBy ?? today);
  const validDate = contractSignBySchema(today, lastDay).safeParse({ signBy }).success;
  const fileError =
    file &&
    (file.size > LIMITS.pdfBytes ||
      !file.name.toLowerCase().endsWith(".pdf") ||
      (file.type && file.type !== "application/pdf"))
      ? "Chọn file PDF tối đa 20 MB."
      : undefined;
  const submit = (note?: string) => {
    if (mutation.isPending || (action === "companySign" && !signature.data)) return;
    setError(null);
    mutation.mutate(
      {
        orderId: contract.orderId,
        version: contract.version,
        action,
        ...(note !== undefined ? { note: note.trim() } : {}),
        ...(action === "extend" ? { signBy } : {}),
        ...(action === "companySign" || action === "upload"
          ? { signerName: name.trim() || undefined, signerTitle: title.trim() || undefined }
          : {}),
        ...(file ? { file } : {}),
      },
      {
        onSuccess: onClose,
        onError: (failure) => {
          if (isContractUnavailable(failure)) onUnavailable();
          else setError(contractEsignError(failure));
        },
      },
    );
  };
  return {
    mutation,
    signature,
    error,
    name,
    setName,
    title,
    setTitle,
    file,
    setFile,
    today,
    lastDay,
    signBy,
    setSignBy,
    validDate,
    fileError,
    submit,
  };
}
