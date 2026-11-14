/** Cấu hình hoá đơn điện tử — BE `EInvoiceSettingsController` (System Admin, docs 21 BR-10). */

import { z } from "zod";

import { api } from "@/lib/api/client";

import { einvoiceProviderDtoSchema, einvoiceSettingsDtoSchema } from "./schemas";

import type {
  EInvoiceProvider,
  EInvoiceSettings,
  ProviderAccountInput,
  SeriesInput,
} from "./types";

const BASE = "/einvoice-settings";
const provider = (code: string) => `${BASE}/providers/${encodeURIComponent(code)}`;

export async function getEInvoiceSettings(signal?: AbortSignal): Promise<EInvoiceSettings> {
  const { data } = await api.get<unknown>(BASE, { signal });
  return einvoiceSettingsDtoSchema.parse(data);
}

/** Bật / tắt tự phát hành nháp đủ thông tin (docs 21 BR-02 mặc định tắt: Kế toán bấm phát hành). */
export async function changeAutoIssue(input: {
  autoIssue: boolean;
  version: number;
}): Promise<EInvoiceSettings> {
  const { data } = await api.put<unknown>(BASE, input);
  return einvoiceSettingsDtoSchema.parse(data);
}

export async function listProviders(signal?: AbortSignal): Promise<EInvoiceProvider[]> {
  const { data } = await api.get<unknown>(`${BASE}/providers`, { signal });
  return z.array(einvoiceProviderDtoSchema).parse(data);
}

export async function storeProviderAccount(
  input: { provider: string; version: number } & ProviderAccountInput,
): Promise<EInvoiceProvider> {
  const { provider: code, ...body } = input;
  const { data } = await api.put<unknown>(`${provider(code)}/account`, body);
  return einvoiceProviderDtoSchema.parse(data);
}

export async function selectSeries(input: { provider: string } & SeriesInput): Promise<void> {
  const { provider: code, ...body } = input;
  await api.put<unknown>(`${provider(code)}/series`, body);
}

export async function activateProvider(input: {
  provider: string;
  version: number;
}): Promise<EInvoiceProvider> {
  const { data } = await api.post<unknown>(`${provider(input.provider)}/activation`, {
    version: input.version,
  });
  return einvoiceProviderDtoSchema.parse(data);
}
