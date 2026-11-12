"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { cartonCheckErrorMessage } from "@/features/fulfillment/carton-check-errors";
import { usePrintShippingLabels } from "@/features/fulfillment/carton-check-mutations";
import { LayeredDialogContent } from "@/components/shared/LayeredDialogContent";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const L = UI_LABELS.cartonCheck.labels;

/**
 * Nhãn giao hàng dạng PDF (docs 08 §4.3 bước 6): xem trước ngay trong hộp thoại, In (hộp thoại in của trình duyệt)
 * hoặc Tải xuống; mỗi thùng một trang 100 × 150 mm. `lpns` bỏ trống = mọi thùng đã dán nhãn chưa vào shipment. Mở sau
 * khi dán nhãn / in lại thì `autoGenerate` tạo file luôn. In nhãn không đổi gì ở BE.
 */
export function ShippingLabelsDialog({
  taskId,
  lpns,
  autoGenerate,
  onClose,
}: {
  taskId: string;
  lpns: readonly string[] | undefined;
  autoGenerate: boolean;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<{ url: string; fileName: string } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const started = useRef(false);
  const { mutate, isPending } = usePrintShippingLabels();

  // Một blob URL cho mỗi file; thu hồi khi tạo lại hoặc đóng
  useEffect(() => (pdf ? () => URL.revokeObjectURL(pdf.url) : undefined), [pdf]);

  const generate = useCallback(() => {
    setError(null);
    mutate(
      { taskId, lpns },
      {
        onSuccess: ({ blob, fileName }) => setPdf({ url: URL.createObjectURL(blob), fileName }),
        onError: (failure) => setError(cartonCheckErrorMessage(failure, { context: "print" })),
      },
    );
  }, [mutate, taskId, lpns]);

  // Mở sau khi dán nhãn / in lại: tạo file đúng một lần
  useEffect(() => {
    if (!autoGenerate || started.current) return;
    started.current = true;
    generate();
  }, [autoGenerate, generate]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <LayeredDialogContent className="border-border-default bg-bg-surface gap-0 rounded-[var(--r-xl)] border p-0 shadow-[var(--sh-lg)] ring-0 sm:max-w-[640px]">
        <DialogHeader className="border-border-default border-b px-[18px] py-4">
          <DialogTitle className="text-ink-primary text-[1.05rem] font-semibold">
            {L.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 px-[18px] py-[18px]">
          <DialogDescription className="text-ink-secondary text-[0.875rem] break-words">
            {lpns && lpns.length > 0 ? L.descriptionLpns(lpns.join(", ")) : L.descriptionAll}
          </DialogDescription>
          {isPending && (
            <p className="text-ink-secondary flex items-center gap-2 text-[0.8125rem]">
              <Loader2 className="size-3.5 animate-spin" /> {L.generating}
            </p>
          )}
          {pdf && (
            <>
              <iframe
                ref={frame}
                title={L.preview}
                src={pdf.url}
                className="border-border-default h-[360px] w-full rounded-[var(--r-sm)] border"
              />
              <p className="text-ink-tertiary text-xs">{L.stickHint}</p>
            </>
          )}
          {error && (
            <p role="alert" className="text-danger text-[0.8125rem]">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="border-border-default bg-bg-subtle mx-0 mb-0 rounded-b-[var(--r-xl)] border-t px-[18px] py-[14px]">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {L.close}
          </Button>
          {pdf && (
            <>
              <Button asChild variant="outline" size="sm">
                <a href={pdf.url} download={pdf.fileName}>
                  <Download className="size-3.5" /> {L.download}
                </a>
              </Button>
              <Button type="button" size="sm" onClick={() => frame.current?.contentWindow?.print()}>
                <Printer className="size-3.5" /> {L.printNow}
              </Button>
            </>
          )}
          <Button
            type="button"
            size="sm"
            variant={pdf ? "outline" : "default"}
            disabled={isPending}
            onClick={generate}
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            {pdf ? L.regenerate : L.generate}
          </Button>
        </DialogFooter>
      </LayeredDialogContent>
    </Dialog>
  );
}
