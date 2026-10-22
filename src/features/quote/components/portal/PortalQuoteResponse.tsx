"use client";

import { useState } from "react";

import { formatMoney } from "@/lib/format/money";
import { quoteErrorMessage } from "@/features/quote/errors";
import { useAcceptQuote, useRequestQuoteChanges } from "@/features/quote/mutations";
import { blankUnits, tierPrice } from "@/features/quote/selectors";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { Quote } from "@/features/quote/types";

/**
 * Khách chấp nhận (có thể điều chỉnh SL từng dòng — BE chọn lại bậc theo tổng phôi, P5) hoặc
 * yêu cầu chỉnh sửa kèm góp ý. Tổng ở đây là TẠM TÍNH; số chốt là `acceptedTotal` BE trả về.
 */
export function PortalQuoteResponse({
  quote,
  sampleBlocked,
}: {
  quote: Quote;
  sampleBlocked: boolean;
}) {
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(quote.lines.map((line) => [line.id, String(line.quantity)])),
  );
  const [confirm, setConfirm] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const accept = useAcceptQuote();
  const requestChanges = useRequestQuoteChanges();

  const parsed = quote.lines.map((line) => ({ line, quantity: Number(qty[line.id]) }));
  const invalid = parsed.some((p) => !Number.isInteger(p.quantity) || p.quantity < 1);
  const units = blankUnits(
    parsed.map((p) => ({ blankSku: p.line.blankSku, quantity: p.quantity })),
  );
  const preview = parsed.map((p) => ({
    ...p,
    unit: tierPrice(p.line.tiers, units.get(p.line.blankSku.toUpperCase()) ?? 0),
  }));
  const belowMoq = preview.some((p) => p.unit === null);
  const total = preview.reduce((sum, p) => sum + (p.unit ?? 0) * (p.quantity || 0), 0);
  const changed = parsed.filter((p) => p.quantity !== p.line.quantity);

  return (
    <section
      aria-labelledby="respond-title"
      className="bg-bg-surface border-border-default space-y-4 rounded-[var(--r-lg)] border p-6 shadow-[var(--sh-md)]"
    >
      <h2 id="respond-title" className="text-lg font-semibold">
        Phản hồi báo giá
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {quote.lines.map((line) => (
          <FormField
            key={line.id}
            id={`accept-${line.id}`}
            label={`Dòng ${line.lineNo} — ${line.blankSku} (cái)`}
          >
            <Input
              id={`accept-${line.id}`}
              inputMode="numeric"
              value={qty[line.id] ?? ""}
              onChange={(event) =>
                setQty((current) => ({ ...current, [line.id]: event.target.value }))
              }
              className={`${FORM_INPUT_CLASS} h-11 text-right tabular-nums`}
            />
          </FormField>
        ))}
      </div>
      <p className="text-ink-secondary text-sm" aria-live="polite">
        {invalid ? (
          "Số lượng phải là số nguyên ≥ 1."
        ) : belowMoq ? (
          "Có phôi dưới số lượng tối thiểu của bậc giá — tăng số lượng hoặc yêu cầu Sales báo giá lại."
        ) : (
          <>
            Tạm tính:{" "}
            <strong className="text-ink-primary tabular-nums">{formatMoney(total, "VND")}</strong>{" "}
            (giá chốt do hệ thống tính khi chấp nhận)
          </>
        )}
      </p>
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="min-h-11" onClick={() => setChangesOpen(true)}>
          Yêu cầu chỉnh sửa
        </Button>
        <Button
          className="min-h-11"
          disabled={invalid || belowMoq || sampleBlocked || accept.isPending}
          title={sampleBlocked ? "Cần duyệt mẫu in trước" : undefined}
          onClick={() => setConfirm(true)}
        >
          Chấp nhận báo giá
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Chấp nhận báo giá?"
        description="Sau khi chấp nhận, bộ phận bán hàng sẽ tạo đơn hàng theo số lượng và đơn giá được chốt."
        confirmLabel="Chấp nhận"
        variant="default"
        loading={accept.isPending}
        closeOnConfirm={false}
        onConfirm={() => {
          setError(null);
          accept.mutate(
            {
              id: quote.id,
              version: quote.version,
              lines: changed.map((p) => ({ lineId: p.line.id, quantity: p.quantity })),
            },
            {
              onSuccess: () => setConfirm(false),
              onError: (failure) => {
                setConfirm(false);
                setError(quoteErrorMessage(failure));
              },
            },
          );
        }}
      />
      <FormDialog open={changesOpen} onOpenChange={setChangesOpen}>
        {changesOpen && (
          <FormDialogBody
            title="Yêu cầu chỉnh sửa báo giá"
            description="Ghi rõ điều cần đổi (số lượng, quy cách in, thời hạn…). Sales sẽ gửi bản báo giá mới."
            submitLabel="Gửi yêu cầu"
            canSubmit={feedback.trim().length > 0 && feedback.length <= 2000}
            isPending={requestChanges.isPending}
            error={error}
            onCancel={() => setChangesOpen(false)}
            onSubmit={() =>
              requestChanges.mutate(
                { id: quote.id, version: quote.version, feedback: feedback.trim() },
                {
                  onSuccess: () => setChangesOpen(false),
                  onError: (failure) => setError(quoteErrorMessage(failure)),
                },
              )
            }
          >
            <label htmlFor="quote-feedback" className="sr-only">
              Nội dung cần chỉnh sửa
            </label>
            <Textarea
              id="quote-feedback"
              autoFocus
              rows={5}
              maxLength={2000}
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
            />
          </FormDialogBody>
        )}
      </FormDialog>
    </section>
  );
}
