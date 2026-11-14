"use client";

import { useState } from "react";

import { getFileLink } from "../api";
import { einvoiceErrorMessage } from "../errors";

import type { EInvoiceFileKind } from "@/constants/einvoice";

/** Xin link có hạn ngắn rồi mở tệp XML / PDF của hoá đơn đã phát hành (docs 21 §1). */
export function useFileDownload(id: string) {
  const [busy, setBusy] = useState<EInvoiceFileKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const download = async (kind: EInvoiceFileKind) => {
    setBusy(kind);
    setError(null);
    try {
      const link = await getFileLink(id, kind);
      window.open(link.url, "_blank", "noopener,noreferrer");
    } catch (failure: unknown) {
      setError(einvoiceErrorMessage(failure));
    } finally {
      setBusy(null);
    }
  };
  return { busy, error, download };
}
