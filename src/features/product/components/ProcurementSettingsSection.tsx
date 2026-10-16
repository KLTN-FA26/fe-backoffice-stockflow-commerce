"use client";

import { Truck } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/shared/Alert";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/ui/button";

import { PROCUREMENT_CONTRACT_TEXT, PROCUREMENT_LABELS } from "../procurement-settings/form-model";
import { ProcurementSettingsEditor } from "./ProcurementSettingsEditor";
import { PROCUREMENT_MISSING, ProcurementSupplierTable } from "./ProcurementSupplierTable";

import type { SkuProcurementSettingsView } from "../procurement-settings/view-model";
import type { CanonicalVariantIdentity } from "../variant-schemas";

/**
 * Mock mode: the illustrative editor over the local procurement fixtures. Real mode: the canonical
 * SKU identity only — BE has no supplier-item / default-supplier contract yet, so nothing is read,
 * shown as data, or saved (contract-audit.md).
 */
type ProcurementSettingsSectionProps =
  | { isMock: true; settings: SkuProcurementSettingsView }
  | { isMock: false; identity: CanonicalVariantIdentity };

export function ProcurementSettingsSection(props: ProcurementSettingsSectionProps) {
  return (
    <section aria-labelledby="procurement-settings-heading">
      <Card>
        {props.isMock ? (
          <MockProcurementSettings settings={props.settings} />
        ) : (
          <ProcurementContractPending identity={props.identity} />
        )}
      </Card>
    </section>
  );
}

function ProcurementHeading({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2
        id="procurement-settings-heading"
        className="text-ink-primary flex items-center gap-2 text-[0.9375rem] font-semibold"
      >
        <Truck className="text-accent size-4" aria-hidden="true" />
        {PROCUREMENT_CONTRACT_TEXT.title}
      </h2>
      {children}
    </div>
  );
}

function ProcurementContractPending({ identity }: { identity: CanonicalVariantIdentity }) {
  return (
    <>
      <ProcurementHeading />
      <div role="status">
        <Alert tone="info" title={PROCUREMENT_CONTRACT_TEXT.pending}>
          {PROCUREMENT_CONTRACT_TEXT.pendingDescription}
        </Alert>
      </div>
      <p className="text-ink-tertiary mt-3 text-xs">
        {PROCUREMENT_CONTRACT_TEXT.appliesTo}{" "}
        <span className="text-ink-secondary font-mono">{identity.sku}</span> ·{" "}
        {PROCUREMENT_CONTRACT_TEXT.reorderPointOwner}
      </p>
    </>
  );
}

function MockProcurementSettings({ settings }: { settings: SkuProcurementSettingsView }) {
  const [saved, setSaved] = useState(settings);
  const [editing, setEditing] = useState(false);
  return (
    <>
      <ProcurementHeading>
        {!editing && (
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            Chỉnh sửa
          </Button>
        )}
      </ProcurementHeading>
      <p className="text-ink-tertiary mb-3 text-xs">
        {editing ? "Dữ liệu minh hoạ · Chỉnh sửa" : "Dữ liệu minh hoạ · Chỉ xem"}
      </p>
      {editing ? (
        <ProcurementSettingsEditor
          isMock
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
          </dl>
          <ProcurementSupplierTable settings={saved} />
        </>
      )}
    </>
  );
}
