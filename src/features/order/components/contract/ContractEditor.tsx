"use client";

import { LoaderCircle, WandSparkles } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DeliveryScheduleEditor } from "./DeliveryScheduleEditor";
import { PaymentPlanEditor } from "./PaymentPlanEditor";
import { useContractEditor } from "./useContractEditor";

import type { SalesContract } from "../../sales-contract-schemas";
import type { Order } from "../../types";

/** Sửa hợp đồng nháp (`PUT /orders/{id}/contract` kèm `version`). */
export function ContractEditor({
  contract,
  order,
  onDone,
}: {
  contract: SalesContract;
  order: Pick<Order, "lines">;
  onDone: () => void;
}) {
  const editor = useContractEditor({
    contract,
    orderLineIds: order.lines.map((line) => line.lineId),
    onSaved: onDone,
  });
  const { form } = editor;
  const errors = form.formState.errors;

  return (
    <form onSubmit={(event) => void editor.submit(event)} noValidate className="space-y-4">
      {editor.formError && <Notice tone="danger">{editor.formError}</Notice>}
      <DeliveryScheduleEditor form={form} lines={order.lines} />
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={editor.suggesting}
          onClick={() => void editor.suggest()}
        >
          {editor.suggesting ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : (
            <WandSparkles className="size-3.5" />
          )}{" "}
          Gợi ý số tiền theo đợt giao
        </Button>
      </div>
      <ConfirmDialog
        open={editor.confirmingSuggest}
        onOpenChange={(open) => {
          if (!open) editor.cancelSuggest();
        }}
        title="Thay lịch thanh toán đang sửa?"
        description="Lịch thanh toán có thay đổi chưa lưu. Gợi ý sẽ thay toàn bộ các đợt bằng số tiền theo từng đợt giao."
        confirmLabel="Thay bằng gợi ý"
        variant="default"
        onConfirm={() => void editor.suggest(true)}
      />
      <PaymentPlanEditor
        form={form}
        totalWithTax={contract.totals.totalAmount}
        currency={contract.totals.currency}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <FormField
          id="contract-samples"
          label="Số lần in mẫu miễn phí"
          error={errors.freeSampleRounds?.message}
        >
          <Input
            {...form.register("freeSampleRounds")}
            {...fieldA11y("contract-samples", errors.freeSampleRounds?.message)}
            inputMode="numeric"
            className={FORM_INPUT_CLASS}
          />
        </FormField>
        <FormField
          id="contract-return"
          label="Thời hạn khiếu nại (ngày)"
          error={errors.returnWindowDays?.message}
        >
          <Input
            {...form.register("returnWindowDays")}
            {...fieldA11y("contract-return", errors.returnWindowDays?.message)}
            inputMode="numeric"
            className={FORM_INPUT_CLASS}
          />
        </FormField>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Đóng
        </Button>
        <Button type="submit" disabled={editor.pending}>
          {editor.pending && <LoaderCircle className="size-4 animate-spin" />} Lưu hợp đồng
        </Button>
      </div>
    </form>
  );
}
