import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";

import { EmptyState } from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { PROCUREMENT_LABELS } from "../procurement-settings/form-model";
import { formatProcurementNumber } from "../procurement-settings/number-display";
import { ProcurementSupplierSelect } from "./ProcurementSupplierSelect";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type {
  ProcurementDraft,
  ProcurementSupplierChoice,
} from "../procurement-settings/form-model";
import type { SkuProcurementSettingsView } from "../procurement-settings/view-model";

export const PROCUREMENT_MISSING = "Chưa có dữ liệu";
export function showProcurementNumber(value: number | null, suffix = "") {
  return value === null ? PROCUREMENT_MISSING : `${formatProcurementNumber(value)}${suffix}`;
}
const TERM_FIELDS = ["supplierItemCode", "leadTimeDays", "moq", "orderMultiple"] as const;

export function ProcurementSupplierTable({
  settings,
  editing,
}: {
  settings: SkuProcurementSettingsView;
  editing?: {
    register: UseFormRegister<ProcurementDraft>;
    errors: FieldErrors<ProcurementDraft>;
    choices: readonly ProcurementSupplierChoice[];
    rowKeys: readonly string[];
  };
}) {
  if (settings.suppliers.length === 0)
    return (
      <EmptyState
        title="Chưa có nhà cung cấp liên kết"
        description="Chưa có dữ liệu liên kết nhà cung cấp cho SKU này."
      />
    );
  return (
    <Table className="min-w-[48rem] table-fixed">
      <TableCaption>Nhà cung cấp liên kết với SKU {settings.skuId}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col" className="w-1/3">
            {PROCUREMENT_LABELS.supplierId}
          </TableHead>
          {TERM_FIELDS.map((field) => (
            <TableHead key={field} scope="col">
              {PROCUREMENT_LABELS[field]}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {settings.suppliers.map((supplier, index) => (
          <TableRow key={editing?.rowKeys[index] ?? index}>
            <TableCell>
              {editing ? (
                <ProcurementSupplierSelect
                  choices={editing.choices}
                  aria-label={`${PROCUREMENT_LABELS.supplierId} · ${index + 1}`}
                  {...editing.register(`suppliers.${index}.supplierId`)}
                />
              ) : (
                <Link
                  href={ADMIN_ROUTES.suppliers.detail(supplier.supplierId)}
                  className="text-accent block wrap-anywhere whitespace-normal hover:underline"
                >
                  {supplier.supplierName}
                </Link>
              )}
              {editing?.errors.suppliers?.[index]?.supplierId?.message && (
                <p role="alert" className="text-danger text-xs break-words whitespace-normal">
                  {editing.errors.suppliers[index]?.supplierId?.message}
                </p>
              )}
            </TableCell>
            {TERM_FIELDS.map((field) => {
              const error = editing?.errors.suppliers?.[index]?.[field]?.message;
              return (
                <TableCell key={field} className="tabular-nums">
                  {editing ? (
                    <Input
                      aria-label={`${PROCUREMENT_LABELS[field]} · ${index + 1}`}
                      aria-invalid={Boolean(error)}
                      type={field === "supplierItemCode" ? "text" : "number"}
                      step="any"
                      {...editing.register(`suppliers.${index}.${field}`)}
                    />
                  ) : field === "supplierItemCode" ? (
                    <span className="block break-all whitespace-normal">
                      {supplier[field] ?? PROCUREMENT_MISSING}
                    </span>
                  ) : (
                    <span
                      className="block wrap-anywhere whitespace-normal"
                      title={supplier[field]?.toString()}
                    >
                      {showProcurementNumber(
                        supplier[field],
                        field === "leadTimeDays" ? " ngày" : "",
                      )}
                    </span>
                  )}
                  {error && (
                    <p role="alert" className="text-danger text-xs break-words whitespace-normal">
                      {error}
                    </p>
                  )}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
