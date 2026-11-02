"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";

import {
  CARTON_LABEL_FORMAT_LABELS,
  CARTON_LABEL_FORMATS,
  CARTON_PRINT_LABELS as P,
} from "@/constants";
import { usePrintCartonLabels } from "@/features/receipt/carton-mutations";
import { receiptErrorMessage } from "@/features/receipt/errors";
import { LayeredDialogContent } from "@/components/shared/LayeredDialogContent";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { CartonLabelFormat } from "@/constants";
import type { PrintCartonLabelsInput } from "@/features/receipt/carton-api";

/** Thùng cần in: mọi thùng còn hiệu lực của một dòng, hoặc in lại theo LPN. */
export type PrintTarget = { receiptLineId: string; count: number } | { lpns: readonly string[] };

/**
 * In nhãn thùng (issue #104): chọn khổ → BE trả PDF → xem trước ngay trong dialog, In (hộp thoại in của trình duyệt)
 * hoặc Tải xuống. Mở từ panel thùng (drawer) nên nằm lớp `--z-dialog-on-drawer`.
 */
export function PrintLabelsDialog({
  target,
  onClose,
}: {
  target: PrintTarget;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<CartonLabelFormat>("THERMAL_ROLL");
  const [error, setError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<{ url: string; fileName: string } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const print = usePrintCartonLabels();

  // Một blob URL cho mỗi file; thu hồi khi tạo lại hoặc đóng
  useEffect(() => (pdf ? () => URL.revokeObjectURL(pdf.url) : undefined), [pdf]);

  const request: PrintCartonLabelsInput =
    "receiptLineId" in target
      ? { receiptLineId: target.receiptLineId, format }
      : { lpns: target.lpns, format };
  const generate = () => {
    setError(null);
    print.mutate(request, {
      onSuccess: ({ blob, fileName }) => setPdf({ url: URL.createObjectURL(blob), fileName }),
      onError: (failure) => setError(receiptErrorMessage(failure)),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <LayeredDialogContent className="border-border-default bg-bg-surface gap-0 rounded-[var(--r-xl)] border p-0 shadow-[var(--sh-lg)] ring-0 sm:max-w-[640px]">
        <DialogHeader className="border-border-default border-b px-[18px] py-4">
          <DialogTitle className="text-ink-primary text-[1.05rem] font-semibold">
            {P.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 px-[18px] py-[18px]">
          <DialogDescription className="text-ink-secondary text-[0.875rem] break-words">
            {"receiptLineId" in target
              ? P.lineDescription(target.count)
              : P.reprintDescription(target.lpns.join(", "))}
          </DialogDescription>
          <fieldset className="space-y-1.5" disabled={print.isPending}>
            <legend className="text-ink-primary mb-1 text-[0.8125rem] font-medium">
              {P.format}
            </legend>
            {CARTON_LABEL_FORMATS.map((option) => (
              <label key={option} className="flex items-center gap-2 text-[0.8125rem]">
                <input
                  type="radio"
                  name="carton-label-format"
                  value={option}
                  checked={format === option}
                  onChange={() => {
                    setFormat(option);
                    setPdf(null);
                  }}
                  className="accent-[var(--brand)]"
                />
                {CARTON_LABEL_FORMAT_LABELS[option]}
              </label>
            ))}
          </fieldset>
          {pdf && (
            <iframe
              ref={frame}
              title={P.preview}
              src={pdf.url}
              className="border-border-default h-[360px] w-full rounded-[var(--r-sm)] border"
            />
          )}
          {error && (
            <p role="alert" className="text-danger text-[0.8125rem]">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="border-border-default bg-bg-subtle mx-0 mb-0 rounded-b-[var(--r-xl)] border-t px-[18px] py-[14px]">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {P.close}
          </Button>
          {pdf && (
            <>
              <Button asChild variant="outline" size="sm">
                <a href={pdf.url} download={pdf.fileName}>
                  <Download className="size-3.5" /> {P.download}
                </a>
              </Button>
              <Button type="button" size="sm" onClick={() => frame.current?.contentWindow?.print()}>
                <Printer className="size-3.5" /> {P.printNow}
              </Button>
            </>
          )}
          <Button
            type="button"
            size="sm"
            variant={pdf ? "outline" : "default"}
            disabled={print.isPending}
            onClick={generate}
          >
            {print.isPending && <Loader2 className="size-3.5 animate-spin" />}
            {pdf ? P.regenerate : P.generate}
          </Button>
        </DialogFooter>
      </LayeredDialogContent>
    </Dialog>
  );
}
