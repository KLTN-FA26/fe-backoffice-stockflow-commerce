import { PRINT_CONFIG_TOAST_MESSAGES } from "@/constants/labels-print-config";
import { toast } from "@/components/shared/Toast";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import { activatePrintConfig, deactivatePrintConfig, savePrintConfig } from "./api";
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

const toastError = (error: unknown) => toast.error(printConfigErrorMessage(error));

/**
 * A save is one request that applies the template and the file together or neither, so a failure leaves the stored
 * configuration as it was. It refreshes every print configuration (version, model file, checksum and status change)
 * and, on any failure, that variant's entry: a stale `version` (409 OPTIMISTIC_LOCK) is then replaced by the current
 * one. The screen shows `printConfigErrorMessage(error)`.
 */
export const useSavePrintConfig = withStaleRefetch(
  createMutation<SavePrintConfigVariables, PrintConfigDto>(save, {
    invalidate: [printConfigKeys.all],
    showErrorToast: false,
    successMessage: PRINT_CONFIG_TOAST_MESSAGES.saved,
  }),
  staleKeys,
  () => true,
);

/**
 * Activating retires the variant's previously active template in the same BE transaction, so it refreshes every
 * print configuration, not only this template's. A stale version or a template that is gone refetches that variant.
 */
export const useActivatePrintConfig = withStaleRefetch(
  createMutation<PrintConfigTarget, PrintConfigDto>(activatePrintConfig, {
    invalidate: [printConfigKeys.all],
    showErrorToast: false,
    successMessage: PRINT_CONFIG_TOAST_MESSAGES.activated,
    onError: toastError,
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
    onError: toastError,
  }),
  staleKeys,
  () => true,
);
