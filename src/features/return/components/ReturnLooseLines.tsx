"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PackagePlus } from "lucide-react";

import { RETURN_RECEIPT_LABELS } from "@/constants/labels-return";
import { RETURN_LIMITS } from "@/constants/returns";
import { DirectUploadError, uploadFileDirect } from "@/lib/api/direct-upload";
import { ApiError } from "@/lib/api/error";
import { Card } from "@/components/shared/Card";
import { FilePickerField } from "@/components/shared/FilePickerField";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { returnEvidenceErrorMessage } from "../errors";
import { looseLineInputSchema } from "../input-schemas";
import { useRecordLooseLine, useRemoveLooseLine } from "../mutations";
import { attachLoosePhoto, beginLoosePhotoUpload } from "../receipt-api";
import { loosePhotoProblem } from "../selectors";

import { EMPTY, MONO } from "./primitives";

import type { LooseLineFormValues, ReturnReceipt } from "../types";

const D = RETURN_RECEIPT_LABELS.detail.loose;
const TH = "py-1 pr-3 font-medium";

/**
 * BE trả VALIDATION_FAILED chung khi SKU không thuộc đơn; ảnh của phiếu nhập chỉ nhận JPEG / PNG ≤ 20 MB (khác ảnh khiếu
 * nại). Còn lại: lỗi PUT lên kho, hoặc theo mã BE.
 */
function looseErrorMessage(failure: unknown): string {
  if (failure instanceof ApiError) {
    if (failure.code === "VALIDATION_FAILED") return D.invalid;
    if (failure.code === "UNSUPPORTED_MEDIA_TYPE") return D.photoWrongType;
    if (failure.code === "PAYLOAD_TOO_LARGE") return D.photoTooLarge;
    if (failure.code === "GOODS_RECEIPT_PHOTO_LIMIT_REACHED") return D.photoLimit;
  }
  return returnEvidenceErrorMessage(failure);
}

function LooseLineForm({ receiptId }: { receiptId: string }) {
  const photoId = useId();
  const photoRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const record = useRecordLooseLine();
  const form = useForm<LooseLineFormValues>({
    resolver: zodResolver(looseLineInputSchema),
    defaultValues: { sku: "", lotNumber: "", quantity: Number.NaN },
  });
  const { errors } = form.formState;

  useEffect(() => () => controller.current?.abort(), []);

  const resetPhoto = () => {
    setPhoto(null);
    if (photoRef.current) photoRef.current.value = "";
  };

  // WF-05 Q-18: ảnh bắt buộc — tải ảnh thẳng lên kho, giữ thành ảnh nhận hàng của phiếu, rồi ghi dòng kèm `photoId`
  // handleSubmit chạy trong sự kiện submit, không lúc render (react-hooks/refs: hàm dùng ref)
  const onValid = async (values: LooseLineFormValues) => {
    setError(null);
    const problem = loosePhotoProblem(photo);
    setPhotoError(problem);
    if (problem || !photo) return;
    const current = new AbortController();
    controller.current = current;
    setUploading(true);
    try {
      const uploadId = await uploadFileDirect({
        file: photo,
        signal: current.signal,
        declare: (declaration, signal) => beginLoosePhotoUpload(receiptId, declaration, signal),
      });
      const photoId = await attachLoosePhoto(receiptId, uploadId);
      await record.mutateAsync({ id: receiptId, ...values, photoId });
      form.reset();
      resetPhoto();
    } catch (failure: unknown) {
      if (!(failure instanceof DirectUploadError && failure.kind === "aborted"))
        setError(looseErrorMessage(failure));
    } finally {
      setUploading(false);
    }
  };
  const busy = uploading || record.isPending;

  return (
    <form
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem] sm:items-end"
      onSubmit={(event) => void form.handleSubmit(onValid)(event)}
      noValidate
    >
      <FormField id="rr-loose-sku" label={D.sku} required error={errors.sku?.message}>
        <Input
          maxLength={RETURN_LIMITS.skuMax}
          className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)]`}
          {...fieldA11y("rr-loose-sku", errors.sku?.message)}
          {...form.register("sku")}
        />
      </FormField>
      <FormField id="rr-loose-lot" label={D.lot} error={errors.lotNumber?.message}>
        <Input
          maxLength={RETURN_LIMITS.lotMax}
          className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)]`}
          {...fieldA11y("rr-loose-lot", errors.lotNumber?.message)}
          {...form.register("lotNumber")}
        />
      </FormField>
      <FormField id="rr-loose-qty" label={D.quantity} required error={errors.quantity?.message}>
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          className={`${FORM_INPUT_CLASS} tabular-nums`}
          {...fieldA11y("rr-loose-qty", errors.quantity?.message)}
          {...form.register("quantity", { valueAsNumber: true })}
        />
      </FormField>
      <div className="sm:col-span-2">
        <FormField id={photoId} label={D.photo} required error={photoError ?? undefined}>
          <FilePickerField
            inputRef={photoRef}
            accept={RETURN_LIMITS.loosePhotoTypes.join(",")}
            fileName={photo?.name}
            disabled={busy}
            {...fieldA11y(photoId, photoError ?? undefined)}
            onChange={(file) => {
              setPhoto(file);
              setPhotoError(file ? loosePhotoProblem(file) : null);
            }}
          />
        </FormField>
      </div>
      <Button type="submit" size="sm" disabled={busy}>
        <PackagePlus className="size-3.5" aria-hidden /> {uploading ? D.photoUploading : D.add}
      </Button>
      {error && (
        <div className="sm:col-span-3">
          <Notice tone="danger" live>
            {error}
          </Notice>
        </div>
      )}
    </form>
  );
}

/**
 * Hàng lẻ không nhãn thùng của phiếu (WF-05 TH-4; BE `/goods-receipts/returns/{id}/loose-lines`): ghi trên phiếu, không
 * nhập tồn, tính là đã về cho yêu cầu trả hàng. WF-05 Q-18: ảnh bắt buộc, tối đa số đã duyệt còn lại (BE kiểm); phiếu có
 * hàng lẻ do Quản lý kho (khác người đếm) xác nhận. `editable` = phiếu nháp của một yêu cầu trả hàng
 * và có quyền sửa (`allowedReturnReceiptActions` → `loose`).
 */
export function ReturnLooseLines({
  receipt,
  editable,
}: {
  receipt: ReturnReceipt;
  editable: boolean;
}) {
  const remove = useRemoveLooseLine();
  const lines = receipt.looseLines ?? [];
  if (!editable && lines.length === 0) return null;

  return (
    <Card className="space-y-3">
      <h2 className="text-ink-primary text-sm font-semibold">{D.title}</h2>
      {editable && <p className="text-ink-tertiary text-xs">{D.hint}</p>}
      {editable && <LooseLineForm receiptId={receipt.id} />}
      {lines.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{D.none}</p>
      ) : (
        <table className="w-full text-[0.8125rem]">
          <caption className="sr-only">{D.title}</caption>
          <thead className="text-ink-tertiary text-left">
            <tr>
              <th scope="col" className={TH}>
                {D.sku}
              </th>
              <th scope="col" className={TH}>
                {D.lot}
              </th>
              <th scope="col" className={`${TH} text-right`}>
                {D.quantity}
              </th>
              <th scope="col" className={TH}>
                {D.photoColumn}
              </th>
              {editable && <th scope="col" className={TH} aria-label={D.remove} />}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--table-line)]">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className={`py-1.5 pr-3 ${MONO}`}>{line.sku}</td>
                <td className={`py-1.5 pr-3 ${MONO}`}>{line.lotNumber ?? EMPTY}</td>
                <td className={`py-1.5 pr-3 text-right ${MONO}`}>{line.quantity}</td>
                <td className="py-1.5 pr-3">
                  {line.photoId ? (
                    <span className="text-positive">{D.hasPhoto}</span>
                  ) : (
                    <span className="text-ink-tertiary">{D.noPhoto}</span>
                  )}
                </td>
                {editable && (
                  <td className="py-1.5 text-right">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={remove.isPending}
                      aria-label={`${D.remove} ${line.sku}`}
                      onClick={() => remove.mutate({ id: receipt.id, lineId: line.id })}
                    >
                      {D.remove}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
