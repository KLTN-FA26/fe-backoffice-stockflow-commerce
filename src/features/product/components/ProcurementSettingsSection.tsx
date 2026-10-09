"use client";

import { Truck } from "lucide-react";
import { useState } from "react";

import { Card } from "@/components/shared/Card";
import { Button } from "@/components/ui/button";

import { PROCUREMENT_LABELS } from "../procurement-settings/form-model";
import { ProcurementSettingsEditor } from "./ProcurementSettingsEditor";
import {
  PROCUREMENT_MISSING,
  ProcurementSupplierTable,
  showProcurementNumber,
} from "./ProcurementSupplierTable";

import type { SkuProcurementSettingsView } from "../procurement-settings/view-model";

export function ProcurementSettingsSection({
  settings,
  isMock,
}: {
  settings: SkuProcurementSettingsView;
  isMock: boolean;
}) {
  const [saved, setSaved] = useState(settings);
  const [editing, setEditing] = useState(false);
  return (
    <section aria-labelledby="procurement-settings-heading">
      <Card>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2
            id="procurement-settings-heading"
            className="text-ink-primary flex items-center gap-2 text-[0.9375rem] font-semibold"
          >
            <Truck className="text-accent size-4" aria-hidden="true" />
            Cài đặt mua hàng
          </h2>
          {isMock && !editing && (
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              Chỉnh sửa
            </Button>
          )}
        </div>
        <p className="text-ink-tertiary mb-3 text-xs">
          {isMock
            ? editing
              ? "Dữ liệu minh hoạ · Chỉnh sửa"
              : "Dữ liệu minh hoạ · Chỉ xem"
            : "Chỉ xem · Chờ kết nối dữ liệu mua hàng"}
        </p>
        {editing ? (
          <ProcurementSettingsEditor
            isMock={isMock}
            settings={saved}
            onCancel={() => setEditing(false)}
            onSaved={(value) => {
              setSaved(value);
              setEditing(false);
            }}
          />
        ) : (
          <>
            <dl className="border-border-default mb-4 grid gap-3 border-b pb-3 text-[0.8125rem] sm:grid-cols-2">
              <div>
                <dt className="text-ink-tertiary text-xs">{PROCUREMENT_LABELS.defaultSupplier}</dt>
                <dd className="text-ink-primary mt-1 wrap-anywhere">
                  {saved.defaultSupplierName ?? saved.defaultSupplierId ?? PROCUREMENT_MISSING}
                </dd>
              </div>
              <div>
                <dt className="text-ink-tertiary text-xs">{PROCUREMENT_LABELS.reorderPoint}</dt>
                <dd
                  className="text-ink-primary mt-1 tabular-nums"
                  title={saved.reorderPoint?.toString()}
                >
                  {showProcurementNumber(saved.reorderPoint)}
                </dd>
              </div>
            </dl>
            <ProcurementSupplierTable settings={saved} />
          </>
        )}
      </Card>
    </section>
  );
}
