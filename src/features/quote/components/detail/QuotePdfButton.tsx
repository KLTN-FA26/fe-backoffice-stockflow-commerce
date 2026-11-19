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
  className,
}: {
  quote: Pick<Quote, "id" | "quoteNumber">;
  onError: (error: unknown) => void;
  className?: string;
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
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={downloading}
      onClick={() => void download()}
      className={className}
    >
      {downloading ? (
        <LoaderCircle className="size-3.5 animate-spin" />
      ) : (
        <FileDown className="size-3.5" />
      )}{" "}
      Tải PDF
    </Button>
  );
}
