"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArchiveRestore } from "lucide-react";

import { RETURN_LABELS } from "@/constants/labels-return";
import { RETURN_LIMITS } from "@/constants/returns";
import { DirectUploadError, uploadFileDirect } from "@/lib/api/direct-upload";
import { Card } from "@/components/shared/Card";
import { FilePickerField } from "@/components/shared/FilePickerField";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { beginCustodyUpload, getEvidenceLink } from "../api";
import { returnErrorMessage, returnEvidenceErrorMessage } from "../errors";
import { custodyInputSchema } from "../input-schemas";
import { useAddCustody } from "../mutations";
import { custodyEvidence, evidenceFileProblem } from "../selectors";

import { CustodyNoteActions, CustodyOutcomeText } from "./CustodyNoteActions";
import { QuantityField } from "./QuantityField";
import { EMPTY, MONO, When } from "./primitives";

import type { CustodyFormValues, ReturnRequest } from "../types";

const C = RETURN_LABELS.detail.custody;
const D = RETURN_LABELS.detail;
const TH = "py-1 pr-3 font-medium";
const MAX = RETURN_LIMITS.evidenceMax;

function CustodyForm({ ret }: { ret: ReturnRequest }) {
  const photoId = useId();
  const photoRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = useAddCustody();
  const form = useForm<CustodyFormValues>({
    resolver: zodResolver(custodyInputSchema),
    defaultValues: { sku: "", lpn: "", quantity: Number.NaN, note: "" },
  });
  const { errors } = form.formState;

  useEffect(() => () => controller.current?.abort(), []);

  // Ảnh bắt buộc (biên nhận có ảnh — Q-11): PUT thẳng lên kho rồi ghi biên nhận kèm `uploadId`
  // handleSubmit chạy trong sự kiện submit, không lúc render (react-hooks/refs: hàm dùng ref)
  const onValid = async (values: CustodyFormValues) => {
    setError(null);
    const problem = photo ? evidenceFileProblem(photo) : C.photoRequired;
    setPhotoError(problem);
    if (problem || !photo) return;
    const current = new AbortController();
    controller.current = current;
    setUploading(true);
    try {
      const uploadId = await uploadFileDirect({
        file: photo,
        signal: current.signal,
        declare: (declaration, signal) => beginCustodyUpload(ret.id, declaration, signal),
      });
      await add.mutateAsync({ id: ret.id, uploadId, ...values });
      form.reset();
      setPhoto(null);
      if (photoRef.current) photoRef.current.value = "";
    } catch (failure: unknown) {
      if (!(failure instanceof DirectUploadError && failure.kind === "aborted"))
        setError(returnEvidenceErrorMessage(failure));
    } finally {
      setUploading(false);
    }
  };
  const busy = uploading || add.isPending;

  return (
    <form
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem] sm:items-start"
      onSubmit={(event) => void form.handleSubmit(onValid)(event)}
      noValidate
    >
      <FormField id="custody-sku" label={C.sku} error={errors.sku?.message}>
        <Input
          maxLength={RETURN_LIMITS.custodySkuMax}
          {...fieldA11y("custody-sku", errors.sku?.message)}
          {...form.register("sku")}
        />
      </FormField>
      <FormField id="custody-lpn" label={C.lpn} error={errors.lpn?.message}>
        <Input
          maxLength={RETURN_LIMITS.custodyLpnMax}
          {...fieldA11y("custody-lpn", errors.lpn?.message)}
          {...form.register("lpn")}
        />
      </FormField>
      <FormField id="custody-qty" label={C.quantity} required error={errors.quantity?.message}>
        <QuantityField
          control={form.control}
          name="quantity"
          inputProps={{
            ...fieldA11y("custody-qty", errors.quantity?.message),
          }}
        />
      </FormField>
      <div className="sm:col-span-3">
        <FormField id="custody-note" label={C.note} error={errors.note?.message}>
          <Textarea
            rows={2}
            maxLength={RETURN_LIMITS.custodyNoteMax}
            className={FORM_TEXTAREA_CLASS}
            {...fieldA11y("custody-note", errors.note?.message)}
            {...form.register("note")}
          />
        </FormField>
      </div>
      <div className="sm:col-span-2">
        <FormField id={photoId} label={C.photo} required error={photoError ?? undefined}>
          <FilePickerField
            inputRef={photoRef}
            accept={RETURN_LIMITS.evidenceTypes.join(",")}
            fileName={photo?.name}
            disabled={busy}
            {...fieldA11y(photoId, photoError ?? undefined)}
            onChange={(file) => {
              setPhoto(file);
              setPhotoError(file ? evidenceFileProblem(file) : null);
            }}
          />
        </FormField>
      </div>
      <Button type="submit" size="sm" className="sm:self-end" disabled={busy}>
        <ArchiveRestore className="size-3.5" aria-hidden /> {uploading ? C.uploading : C.add}
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

/** "SKU × 4" / "LPN × 4" — hàng trên biên nhận, cho câu xác nhận ghi rời kho. */
export function custodyWhat(
  custody: { sku?: string | null; lpn?: string | null; quantity: number } | null | undefined,
): string {
  if (!custody) return EMPTY;
  return `${custody.lpn ?? custody.sku ?? EMPTY} × ${custody.quantity.toLocaleString("vi-VN")}`;
}

/**
 * Biên nhận giữ hộ của yêu cầu (WF-05 Q-11; BE G4 `/returns/{id}/custody`, stage CUSTODY): hàng về mà phiếu nhập hàng
 * hoàn không nhận — SKU không được duyệt (`RETURN_CARTON_NOT_CLAIMED`), vượt số duyệt (`RETURN_LOOSE_EXCEEDS_APPROVED`),
 * kiện về sau khi đã chốt tiền. Hàng vẫn là của khách: không nhập tồn, không hoàn, không điều chỉnh hoá đơn. Ghi được ở
 * mọi trạng thái của yêu cầu (`sales-rmas:CREATE`); mỗi yêu cầu tối đa `evidenceMax` biên nhận (BE
 * `RETURN_EVIDENCE_LIMIT_REACHED`).
 */
export function ReturnCustodyCard({ ret, canAdd }: { ret: ReturnRequest; canAdd: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const kept = custodyEvidence(ret);
  if (!canAdd && kept.length === 0) return null;
  const full = kept.length >= MAX;

  const open = async (evidenceId: string) => {
    setError(null);
    setOpening(evidenceId);
    try {
      const url = await getEvidenceLink(ret.id, evidenceId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (failure: unknown) {
      setError(returnErrorMessage(failure));
    } finally {
      setOpening(null);
    }
  };

  return (
    <Card className="space-y-3">
      <h2 className="text-ink-primary text-sm font-semibold">{C.title}</h2>
      <p className="text-ink-secondary text-[0.8125rem]">{C.hint}</p>
      {kept.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{C.none}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[0.8125rem]">
            <thead className="text-ink-tertiary text-left">
              <tr>
                <th scope="col" className={TH}>
                  {C.sku}
                </th>
                <th scope="col" className={TH}>
                  {C.lpn}
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  {C.quantity}
                </th>
                <th scope="col" className={TH}>
                  {C.note}
                </th>
                <th scope="col" className={TH}>
                  {C.receivedAt}
                </th>
                <th scope="col" className={TH}>
                  {C.outcome}
                </th>
                <th scope="col" className={TH} aria-label={D.openPhoto} />
              </tr>
            </thead>
            <tbody>
              {kept.map((photo) => (
                <tr key={photo.id} className="border-border-default border-t">
                  <td className={`py-1.5 pr-3 ${MONO}`}>{photo.custody?.sku ?? EMPTY}</td>
                  <td className={`py-1.5 pr-3 ${MONO}`}>{photo.custody?.lpn ?? EMPTY}</td>
                  <td className={`py-1.5 pr-3 text-right ${MONO}`}>
                    {photo.custody?.quantity ?? EMPTY}
                  </td>
                  <td className="py-1.5 pr-3">{photo.custody?.note ?? EMPTY}</td>
                  <td className="py-1.5 pr-3">
                    <When iso={photo.uploadedAt} />
                  </td>
                  {/* Audit r3 RAD-3: kết cục của hàng giữ hộ — lựa chọn của khách, đã rời kho */}
                  <td className="py-1.5 pr-3">
                    <CustodyOutcomeText outcome={photo.custody?.outcome} />
                  </td>
                  <td className="space-x-1.5 py-1.5 text-right whitespace-nowrap">
                    <CustodyNoteActions
                      target={{
                        returnId: ret.id,
                        rmaNumber: ret.rmaNumber,
                        customerId: ret.customerId,
                        evidenceId: photo.id,
                        outcome: photo.custody?.outcome,
                        what: custodyWhat(photo.custody),
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={opening === photo.id}
                      onClick={() => void open(photo.id)}
                    >
                      {D.openPhoto}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && (
        <Notice tone="danger" live>
          {error}
        </Notice>
      )}
      {canAdd &&
        (full ? (
          <p className="text-ink-tertiary text-xs">{C.full(MAX)}</p>
        ) : (
          <CustodyForm ret={ret} />
        ))}
    </Card>
  );
}
