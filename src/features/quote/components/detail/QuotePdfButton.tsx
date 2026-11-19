"use client";

import { useState } from "react";
import { FileDown, LoaderCircle } from "lucide-react";

import { openBlob } from "@/lib/files/open-blob";
import { getQuotePdf } from "@/features/quote/api";
import { Button } from "@/components/ui/button";

import type { Quote } from "@/features/quote/types";

/** `GET /quotes/{id}/document` → mở PDF ở tab mới. */
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
    <Button size="sm" variant="outline" disabled={downloading} onClick={() => void download()}>
      {downloading ? (
        <LoaderCircle className="size-3.5 animate-spin" />
      ) : (
        <FileDown className="size-3.5" />
      )}{" "}
      Tải PDF
    </Button>
  );
}
