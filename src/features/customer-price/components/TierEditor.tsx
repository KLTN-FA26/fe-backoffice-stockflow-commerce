"use client";

import { PriceTierEditor } from "@/components/backoffice/PriceTierEditor";

import type { UseFormReturn } from "react-hook-form";
import type { CustomerPriceFormValues } from "../form";

/** Bậc giá của bảng giá khách — ô nhập chung với giá chuẩn (`PriceTierEditor`). */
export function TierEditor({ form }: { form: UseFormReturn<CustomerPriceFormValues> }) {
  return <PriceTierEditor form={form} idPrefix="cp" />;
}
