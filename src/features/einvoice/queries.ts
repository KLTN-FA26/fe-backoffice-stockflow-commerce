import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import {
  getEInvoice,
  getRegister,
  listCorrections,
  listEInvoices,
  listErrorNotices,
  listProviderCalls,
} from "./api";
import { getEInvoiceSettings, listProviders } from "./settings-api";

import type { ListEInvoiceParams } from "./api";
import type { EInvoice, EInvoiceListItem, RegisterRange } from "./types";

/** Root `einvoices` — trùng `QUERY_ROOTS.einvoices` để màn đơn hàng làm mới được hoá đơn. */
export const einvoiceKeys = createQueryKeys<ListEInvoiceParams>("einvoices");
export const einvoiceSettingsKeys = { all: ["einvoice-settings"] as const };

export const useEInvoices = createListQuery<EInvoiceListItem, ListEInvoiceParams>(
  einvoiceKeys,
  listEInvoices,
);
export const useEInvoice = createDetailQuery<EInvoice>(einvoiceKeys, getEInvoice);

/** Hoá đơn `SUBMITTING`: hỏi lại BE vài giây một lần tới khi có kết quả (docs 21 §4.2 bước 6). */
export const SUBMITTING_REFETCH_MS = 5_000;

const sub = (id: string | null | undefined, part: string) => [...einvoiceKeys.all, part, id ?? ""];

export const useProviderCalls = (id: string | null | undefined) =>
  useQuery({
    queryKey: sub(id, "provider-calls"),
    queryFn: ({ signal }) => listProviderCalls(id ?? "", signal),
    enabled: !!id,
    ...QUERY_TIMES.detail,
  });

export const useCorrections = (id: string | null | undefined) =>
  useQuery({
    queryKey: sub(id, "corrections"),
    queryFn: ({ signal }) => listCorrections(id ?? "", signal),
    enabled: !!id,
    ...QUERY_TIMES.detail,
  });

export const useErrorNotices = (id: string | null | undefined, enabled = true) =>
  useQuery({
    queryKey: sub(id, "error-notices"),
    queryFn: ({ signal }) => listErrorNotices(id ?? "", signal),
    enabled: enabled && !!id,
    ...QUERY_TIMES.detail,
  });

export const useRegister = (range: RegisterRange | null) =>
  useQuery({
    queryKey: [...einvoiceKeys.all, "register", range?.from ?? "", range?.to ?? ""],
    queryFn: ({ signal }) => getRegister(range ?? { from: "", to: "" }, signal),
    enabled: !!range,
    ...QUERY_TIMES.list,
  });

export const useEInvoiceSettings = (enabled = true) =>
  useQuery({
    queryKey: [...einvoiceSettingsKeys.all, "current"],
    queryFn: ({ signal }) => getEInvoiceSettings(signal),
    enabled,
    ...QUERY_TIMES.detail,
  });

export const useEInvoiceProviders = (enabled = true) =>
  useQuery({
    queryKey: [...einvoiceSettingsKeys.all, "providers"],
    queryFn: ({ signal }) => listProviders(signal),
    enabled,
    ...QUERY_TIMES.detail,
  });
