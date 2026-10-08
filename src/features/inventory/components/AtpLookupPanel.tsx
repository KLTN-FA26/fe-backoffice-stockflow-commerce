"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/format/number";

import { INVENTORY_COPY } from "../constants";
import { useInventoryAtp } from "../queries";
import { atpLookupInputSchema } from "../schemas";

import type { InventoryService } from "../service";
import type { AtpLookupInput, StockLevelRow } from "../types";

export function AtpLookupPanel({
  rows,
  service,
}: {
  rows: StockLevelRow[];
  service: InventoryService;
}) {
  const [submitted, setSubmitted] = useState<AtpLookupInput | null>(null);
  const form = useForm<AtpLookupInput>({
    resolver: zodResolver(atpLookupInputSchema),
    defaultValues: { sku: "", warehouseCode: "" },
  });
  const query = useInventoryAtp(service, submitted);
  // TODO(contract): replace stock-level-derived options when BE confirms warehouse scope/source.
  const warehouses = Array.from(
    new Map(rows.map((row) => [row.warehouse.code, row.warehouse])).values(),
  );
  const onLookup = (input: AtpLookupInput) => {
    if (submitted?.sku === input.sku && submitted.warehouseCode === input.warehouseCode) {
      void query.refetch();
    } else {
      setSubmitted(input);
    }
  };

  return (
    <section
      aria-labelledby="inventory-atp"
      className="border-border-default bg-bg-surface space-y-4 rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <h2 id="inventory-atp" className="text-ink-primary font-semibold">
        ATP Lookup
      </h2>
      <form onSubmit={form.handleSubmit(onLookup)} className="space-y-3" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="inventory-atp-sku">SKU</Label>
            <Input
              {...form.register("sku")}
              id="inventory-atp-sku"
              placeholder="Nhập SKU"
              aria-invalid={Boolean(form.formState.errors.sku)}
              aria-describedby={form.formState.errors.sku ? "inventory-atp-sku-error" : undefined}
            />
            {form.formState.errors.sku && (
              <p id="inventory-atp-sku-error" role="alert" className="text-danger text-xs">
                {form.formState.errors.sku.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="inventory-atp-warehouse">Kho</Label>
            <Controller
              control={form.control}
              name="warehouseCode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="inventory-atp-warehouse"
                    aria-label="Kho"
                    aria-invalid={Boolean(form.formState.errors.warehouseCode)}
                    aria-describedby={
                      form.formState.errors.warehouseCode
                        ? "inventory-atp-warehouse-error"
                        : undefined
                    }
                    className="w-full"
                  >
                    <SelectValue placeholder="Chọn kho" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.code} value={warehouse.code}>
                        {warehouse.name ?? warehouse.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.warehouseCode && (
              <p id="inventory-atp-warehouse-error" role="alert" className="text-danger text-xs">
                {form.formState.errors.warehouseCode.message}
              </p>
            )}
          </div>
        </div>
        <Button type="submit" disabled={Boolean(submitted) && query.isFetching}>
          {INVENTORY_COPY.lookupAtp}
        </Button>
      </form>
      {!submitted ? (
        <p className="text-ink-tertiary text-sm">{INVENTORY_COPY.atpPrompt}</p>
      ) : query.isPending ? (
        <div role="status" aria-label={INVENTORY_COPY.atpLoading} className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-24" />
        </div>
      ) : query.isError ? (
        <EmptyState
          title={INVENTORY_COPY.atpError}
          action={<Button onClick={() => void query.refetch()}>{INVENTORY_COPY.retry}</Button>}
        />
      ) : query.data === null ? (
        <EmptyState title={INVENTORY_COPY.atpNotFound} />
      ) : (
        <output className="border-border-default bg-bg-subtle block rounded-[var(--r-sm)] border p-3">
          <p className="text-ink-secondary text-xs">
            {query.data.sku} · {query.data.warehouseCode}
          </p>
          <p className="text-ink-primary font-mono text-2xl font-semibold tabular-nums">
            {formatNumber(query.data.quantity)}
          </p>
          {query.data.quantity === 0 && (
            <p className="text-ink-secondary text-xs">{INVENTORY_COPY.atpZero}</p>
          )}
        </output>
      )}
    </section>
  );
}
