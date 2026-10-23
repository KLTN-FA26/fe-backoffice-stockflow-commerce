"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { useForm } from "react-hook-form";

import { INVENTORY_LABELS } from "@/constants/inventory";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { skuLookupInput } from "../stock-schemas";

import type { z } from "zod";

type SkuForm = z.input<typeof skuLookupInput>;
type SkuLookup = z.output<typeof skuLookupInput>;

/**
 * Exact-SKU lookup. Typing only edits the draft — nothing is requested until the form is
 * submitted (button or Enter), which trims and upper-cases the code like the backend `Sku`.
 */
export function InventorySkuLookup({
  activeSku,
  onSubmit,
}: {
  activeSku: string | null;
  onSubmit: (sku: string) => void;
}) {
  const form = useForm<SkuForm, unknown, SkuLookup>({
    resolver: zodResolver(skuLookupInput),
    defaultValues: { sku: "" },
  });
  const error = form.formState.errors.sku?.message;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(({ sku }) => onSubmit(sku))}
      className="border-border-default bg-bg-surface flex flex-wrap items-end gap-[var(--el-gap)] rounded-[var(--r-sm)] border p-[var(--card-pad)]"
    >
      <div className="min-w-64 flex-1 space-y-1">
        <Label htmlFor="inventory-sku">{INVENTORY_LABELS.skuLookup}</Label>
        <Input
          {...form.register("sku")}
          id="inventory-sku"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder={INVENTORY_LABELS.skuPlaceholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "inventory-sku-error" : undefined}
          className="font-mono"
        />
        {error && (
          <p id="inventory-sku-error" role="alert" className="text-danger text-xs">
            {error}
          </p>
        )}
      </div>
      <Button className="rounded-[var(--r-sm)]" type="submit">
        <Search aria-hidden="true" />
        {INVENTORY_LABELS.lookup}
      </Button>
      {activeSku && (
        <p role="status" className="text-ink-secondary w-full text-sm">
          {INVENTORY_LABELS.activeSku}: <span className="font-mono">{activeSku}</span>
        </p>
      )}
    </form>
  );
}
