"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

import { openBlob } from "@/lib/files/open-blob";
import { getQuotePdf } from "@/features/quote/api";
import { ActionTrigger } from "@/components/shared/ObjectActions";

import type { Quote } from "@/features/quote/types";

/** `GET /quotes/{id}/document` → mở PDF ở tab mới. Mục "Tải PDF" của menu "⋯" trên header báo giá. */
export function QuotePdfButton({
  quote,
  onError,
}: {
  quote: Pick<Quote, "id" | "quoteNumber">;
  onError: (error: unknown) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const download = async () => {
    setDownloading(true);
    try {
      openBlob(await getQuotePdf(quote.id), `${quote.quoteNumber}.pdf`);
    } catch (error) {
      onError(error);
    } finally {
      setDownloading(false);
    }
  };
  return (
    <ActionTrigger
      icon={FileDown}
      label="Tải PDF"
      loading={downloading}
      onClick={() => void download()}
    />
  );
}
