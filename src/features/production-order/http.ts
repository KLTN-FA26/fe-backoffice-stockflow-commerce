/** Helper HTTP của LSX — đường dẫn, đọc danh sách, POST thao tác trả chi tiết LSX đã parse. */

import { z } from "zod";

import { api } from "@/lib/api/client";

import { productionDetailDtoSchema } from "./schemas";

import type { ProductionDetail } from "./types";

export const BASE = "/production/orders";

export const byId = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

export async function getList<T extends z.ZodType>(path: string, schema: T, signal?: AbortSignal) {
  const { data } = await api.get<unknown>(path, { signal });
  return z.array(schema).parse(data);
}

/* ── Thao tác ────────────────────────────────────────────────────────── */

export async function act(id: string, path: string, body?: object): Promise<ProductionDetail> {
  const { data } = await api.post<unknown>(`${byId(id)}/${path}`, body);
  return productionDetailDtoSchema.parse(data);
}
