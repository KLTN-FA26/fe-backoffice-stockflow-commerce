"use client";

import { FileDown, FileText, FileUp } from "lucide-react";
import { useId, useState } from "react";

import { PRINT_CONFIG_REFERENCE_LABELS as TEXT } from "@/constants/labels-print-config";
import {
  fileTooLargeMessage,
  PRINT_REFERENCE_TYPES,
  uploadFileMaxBytes,
} from "@/constants/upload-limits";

import { openLink } from "@/lib/files/open-blob";

import { DetailSection } from "@/components/shared/DetailSection";
import { Button } from "@/components/ui/button";

import { getReferenceFileLink } from "../api";
import { printConfigErrorMessage } from "../errors";
import { useAttachReferenceFile } from "../mutations";

import type { PrintConfigDto } from "../types";

const ACCEPT = [".pdf", ".png", ...PRINT_REFERENCE_TYPES].join(",");

const isReferenceType = (file: File) =>
  (PRINT_REFERENCE_TYPES as readonly string[]).includes(file.type);

/**
 * "File khuôn tham chiếu" of a saved print configuration (BD-7, kltn-docs WF-02 item 51): the attached file's name, a
 * download that asks the BE for a fresh short-lived link on each click, and — for who may edit a configuration of a
 * product still sold (`canAttach`, same gate as the save) — attach / replace. Type and size are checked here before
 * anything is sent; the BE re-checks and scans. No pending-design warning: the die-line is not part of the print version.
 */
export function ReferenceFileSection({
  config,
  canAttach,
}: {
  config: PrintConfigDto;
  canAttach: boolean;
}) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const attach = useAttachReferenceFile();
  const { productId, variantId, templateId, version, referenceFileName } = config;

  const pick = (file: File | null) => {
    if (!file) return;
    if (!isReferenceType(file)) return setError(TEXT.wrongType);
    if (file.size > uploadFileMaxBytes("printReference"))
      return setError(fileTooLargeMessage("printReference"));
    setError(null);
    attach.mutate({ productId, variantId, templateId, version, file });
  };

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      openLink((await getReferenceFileLink(productId, variantId, templateId)).url);
    } catch (failure) {
      setError(printConfigErrorMessage(failure, "reference"));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <DetailSection title={TEXT.title} icon={FileText}>
      <div className="space-y-2 text-sm">
        <p className="text-ink-secondary text-xs">{TEXT.hint}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className={referenceFileName ? "text-ink-primary" : "text-ink-tertiary"}>
            {referenceFileName ?? TEXT.none}
          </span>
          {referenceFileName && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={downloading}
              onClick={() => void download()}
            >
              <FileDown className="size-3.5" /> {TEXT.download}
            </Button>
          )}
          {canAttach && (
            <label
              htmlFor={inputId}
              aria-disabled={attach.isPending}
              className="border-border-default text-ink-primary hover:bg-bg-muted focus-within:ring-ring inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[var(--r-sm)] border px-3 text-xs font-medium focus-within:ring-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              <FileUp className="size-3.5" />
              {attach.isPending ? TEXT.uploading : referenceFileName ? TEXT.replace : TEXT.attach}
              <input
                id={inputId}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                aria-label={TEXT.inputLabel}
                disabled={attach.isPending}
                onChange={(event) => {
                  pick(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        {error && (
          <p role="alert" className="text-danger text-xs">
            {error}
          </p>
        )}
      </div>
    </DetailSection>
  );
}
