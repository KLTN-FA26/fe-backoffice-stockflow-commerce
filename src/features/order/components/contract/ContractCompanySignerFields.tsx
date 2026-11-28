"use client";

import {
  CONTRACT_ESIGN_LABELS as L,
  CONTRACT_ESIGN_LIMITS as LIMITS,
} from "@/constants/contract-esign";

import { formatDateTime } from "@/lib/format/date";

import { FormField, FORM_INPUT_CLASS } from "@/components/shared/FormField";
import { Notice } from "@/components/shared/Notice";
import { Input } from "@/components/ui/input";

import type { CompanyCertificate } from "../../sales-contract-esign-schemas";

export function ContractCompanySignerFields({
  name,
  setName,
  title,
  setTitle,
  company,
}: {
  name: string;
  setName: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  company: CompanyCertificate | null | undefined;
}) {
  return (
    <div className="space-y-3">
      <FormField id="company-signer-name" label={L.sellerSignerName}>
        <Input
          id="company-signer-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={LIMITS.companySigner}
          className={FORM_INPUT_CLASS}
        />
      </FormField>
      <FormField id="company-signer-title" label={L.sellerSignerTitle}>
        <Input
          id="company-signer-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={LIMITS.companySigner}
          className={FORM_INPUT_CLASS}
        />
      </FormField>
      {company?.subject && (
        <p className="text-ink-secondary text-xs break-words">
          {company.subject} · {company.issuer}
        </p>
      )}
      {company?.serial && (
        <p className="text-ink-secondary text-xs break-all">Số chứng thư: {company.serial}</p>
      )}
      {company?.notBefore && (
        <p className="text-ink-secondary text-xs">
          Có hiệu lực: {formatDateTime(company.notBefore)}
        </p>
      )}
      {company?.notAfter && (
        <p className="text-ink-secondary text-xs">Hết hạn: {formatDateTime(company.notAfter)}</p>
      )}
      {(!company || company.testCertificate) && (
        <Notice tone="warning">
          {company?.testCertificate ? L.testWarning : L.certificateMissing}
        </Notice>
      )}
      <Notice tone="info">{L.fourEyes}</Notice>
    </div>
  );
}
