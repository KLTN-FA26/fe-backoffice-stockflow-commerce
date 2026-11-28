"use client";

import {
  CONTRACT_ESIGN_LABELS as L,
  CONTRACT_ESIGN_LIMITS as LIMITS,
} from "@/constants/contract-esign";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DatePicker } from "@/components/shared/DatePicker";
import { FilePickerField } from "@/components/shared/FilePickerField";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";

import { ContractCompanySignerFields } from "./ContractCompanySignerFields";
import { useContractEsignDialog } from "./useContractEsignDialog";

import type { ContractEsignAction } from "../../sales-contract-esign-api";
import type { SalesContract } from "../../sales-contract-schemas";

export function ContractEsignDialog({
  action,
  contract,
  onClose,
  onUnavailable,
}: {
  action: ContractEsignAction;
  contract: SalesContract;
  onClose: () => void;
  onUnavailable: () => void;
}) {
  const {
    mutation,
    signature,
    error,
    name,
    setName,
    title,
    setTitle,
    file,
    setFile,
    today,
    lastDay,
    signBy,
    setSignBy,
    validDate,
    fileError,
    submit,
  } = useContractEsignDialog({ action, contract, onClose, onUnavailable });
  if (action === "extend" || action === "upload")
    return (
      <FormDialog open onOpenChange={(open) => !open && !mutation.isPending && onClose()}>
        <FormDialogBody
          title={L[action]}
          description={
            action === "extend"
              ? "Chọn hạn ký từ hôm nay đến tối đa 60 ngày tới."
              : "Tải PDF có chữ ký số hợp lệ trên đúng bản đã tải để ký ngoài. Bản scan không được chấp nhận ở bước này."
          }
          submitLabel={L[action]}
          canSubmit={action === "extend" ? validDate : !!file && !fileError}
          isPending={mutation.isPending}
          error={error}
          onCancel={onClose}
          onSubmit={() => submit()}
        >
          {action === "extend" ? (
            <FormField
              id="contract-sign-by"
              label="Hạn ký"
              required
              error={validDate ? undefined : "Ngày ký phải từ hôm nay đến tối đa 60 ngày tới"}
            >
              <DatePicker
                value={signBy}
                min={today}
                max={lastDay}
                onChange={setSignBy}
                {...fieldA11y("contract-sign-by", validDate ? undefined : "Ngày không hợp lệ")}
              />
            </FormField>
          ) : (
            <FormField id="company-signed-file" label="Bản đã ký số" required error={fileError}>
              <FilePickerField
                accept=".pdf,application/pdf"
                fileName={file?.name}
                onChange={setFile}
                {...fieldA11y("company-signed-file", fileError)}
              />
              {!file && <p className="text-ink-secondary text-xs">Chọn file PDF để tiếp tục.</p>}
            </FormField>
          )}
        </FormDialogBody>
      </FormDialog>
    );
  const company = signature.data;
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${L[action]}?`}
      description={
        action === "companySign"
          ? "Hợp đồng có hiệu lực sau khi công ty ký. Hãy kiểm tra người ký và chứng thư."
          : "Xác nhận xử lý điều khoản của hợp đồng này."
      }
      confirmLabel={L[action]}
      variant={action === "reject" ? "danger" : "default"}
      requireReason={action === "reject"}
      reasonLabel="Lý do từ chối"
      reasonMaxLength={LIMITS.rejectNote}
      loading={mutation.isPending}
      confirmDisabled={action === "companySign" && !company}
      closeOnConfirm={false}
      error={error ?? (action === "companySign" && signature.isError ? L.failure : null)}
      onConfirm={submit}
    >
      {action === "companySign" && (
        <ContractCompanySignerFields
          name={name}
          setName={setName}
          title={title}
          setTitle={setTitle}
          company={company}
        />
      )}
    </ConfirmDialog>
  );
}
