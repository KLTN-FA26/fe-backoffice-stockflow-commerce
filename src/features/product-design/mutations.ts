import { useQueryClient } from "@tanstack/react-query";

import { PRINT_CONFIG_TOAST_MESSAGES } from "@/constants/labels-print-config";
import { toast } from "@/components/shared/Toast";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import {
  activatePrintConfig,
  attachReferenceFile,
  deactivatePrintConfig,
  savePrintConfig,
} from "./api";
import { printConfigErrorMessage } from "./errors";
import { printConfigKeys } from "./queries";

import type { PrintConfigDto, PrintConfigSaveInput, PrintConfigTarget } from "./types";

export interface SavePrintConfigVariables {
  productId: string;
  variantId: string;
  input: PrintConfigSaveInput;
}

const save = ({ productId, variantId, input }: SavePrintConfigVariables) =>
  savePrintConfig(productId, variantId, input);

const staleKeys = ({ productId, variantId }: { productId: string; variantId: string }) => [
  printConfigKeys.variant(productId, variantId),
];

/**
 * A save is one request (see `savePrintConfig`): template and file are stored together or not at all. It refreshes
 * every print configuration on success (version, file, checksum and status change) and, on any failure, that variant's
 * entry: a stale `version` (409 OPTIMISTIC_LOCK), a refused measured value (409 PRINT_CONFIG_MODEL_FILE_REQUIRED) or a
 * stored file that is not the measured one is then replaced by what the BE holds. The screen shows
 * `printConfigErrorMessage(error)`; the success toast is only for a save the BE confirmed with the measured file.
 */
const useSaveRequest = withStaleRefetch(
  createMutation<SavePrintConfigVariables, PrintConfigDto>(save, {
    invalidate: [printConfigKeys.all],
    showErrorToast: false,
    successMessage: PRINT_CONFIG_TOAST_MESSAGES.saved,
  }),
  staleKeys,
  () => true,
);

/**
 * The save, plus the template it returned written into the variant's entry at once: the next save starts from the
 * `version` the BE answered (which may have moved by more than one) without waiting for the refetch, so a quick second
 * save is not refused as OPTIMISTIC_LOCK. The entry holds the template the screen shows (`pickPrintConfig`), so it is
 * replaced only when it is that template, or when the variant had none.
 */
export const useSavePrintConfig: typeof useSaveRequest = (options) => {
  const queryClient = useQueryClient();
  return useSaveRequest({
    ...options,
    onSuccess: (...args) => {
      const [saved, { productId, variantId }] = args;
      queryClient.setQueryData<PrintConfigDto | null>(
        printConfigKeys.variant(productId, variantId),
        (current) => (!current || current.templateId === saved.templateId ? saved : current),
      );
      options?.onSuccess?.(...args);
    },
  });
};

/**
 * Activating retires the variant's previously active template in the same BE transaction, so it refreshes every
 * print configuration, not only this template's. Any failure refetches that variant; the toast says why in the words
 * of activation (a file or a complete area ↔ mesh table is missing).
 */
export const useActivatePrintConfig = withStaleRefetch(
  createMutation<PrintConfigTarget, PrintConfigDto>(activatePrintConfig, {
    invalidate: [printConfigKeys.all],
    showErrorToast: false,
    successMessage: PRINT_CONFIG_TOAST_MESSAGES.activated,
    onError: (error: unknown) => toast.error(printConfigErrorMessage(error, "activate")),
  }),
  staleKeys,
  () => true,
);

/** Deactivating changes the status of this template only; it refreshes the print configurations the same way. */
export const useDeactivatePrintConfig = withStaleRefetch(
  createMutation<PrintConfigTarget, PrintConfigDto>(deactivatePrintConfig, {
    invalidate: [printConfigKeys.all],
    showErrorToast: false,
    successMessage: PRINT_CONFIG_TOAST_MESSAGES.deactivated,
    onError: (error: unknown) => toast.error(printConfigErrorMessage(error)),
  }),
  staleKeys,
  () => true,
);

export type AttachReferenceVariables = PrintConfigTarget & { file: File };

const useAttachReferenceRequest = withStaleRefetch(
  createMutation<AttachReferenceVariables, PrintConfigDto>(attachReferenceFile, {
    invalidate: [printConfigKeys.all],
    showErrorToast: false,
    successMessage: PRINT_CONFIG_TOAST_MESSAGES.referenceAttached,
    onError: (error: unknown) => toast.error(printConfigErrorMessage(error, "reference")),
  }),
  staleKeys,
  () => true,
);

/**
 * Attaching the reference die-line (BD-7) bumps the template's `version` but not its print version, so it warns about no
 * pending design (`PRINT_CONFIG_PENDING_WARNING.attachReference`). The returned template goes into the variant's entry at
 * once, as a save does, so an edit open beside it saves on the new `version`; any failure refetches the variant.
 */
export const useAttachReferenceFile: typeof useAttachReferenceRequest = (options) => {
  const queryClient = useQueryClient();
  return useAttachReferenceRequest({
    ...options,
    onSuccess: (...args) => {
      const [saved, { productId, variantId }] = args;
      queryClient.setQueryData<PrintConfigDto | null>(
        printConfigKeys.variant(productId, variantId),
        (current) => (!current || current.templateId === saved.templateId ? saved : current),
      );
      options?.onSuccess?.(...args);
    },
  });
};
