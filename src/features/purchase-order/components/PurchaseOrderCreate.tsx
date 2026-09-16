"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "cn";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  ClipboardCheck,
  FileText,
  Layers,
  Package,
  Plus,
  Save,
  Send,
  Settings2,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { ADMIN_ROUTES, PAGE_SIZE } from "@/constants";
import {
  formatMoney,
  usePoSuppliers,
  usePoWarehouses,
  usePurchaseOrders,
} from "@/features/purchase-order";
import { useSkus } from "@/features/product";
import { Card } from "@/components/shared/Card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusDot } from "@/components/shared/StatusDot";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Textarea } from "@/components/ui/textarea";

import type { Currency, Supplier, Warehouse } from "@/features/purchase-order";
import type { Sku } from "@/features/product";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type StepKey = "info" | "lines" | "totals" | "review";

type FormState = {
  supplierId: string;
  warehouseId: string;
  orderDate: string;
  expectedDate: string;
  currency: Currency;
  paymentTerms: string;
  notes: string;
  lines: PoLineDraft[];
};

type PoLineDraft = {
  id: string;
  skuId: string;
  orderedQty: string;
  unitPrice: string;
  taxRate: string;
  discountRate: string;
  uom: string;
};

type ValidationIssue = {
  step: StepKey;
  message: string;
};

type Totals = {
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
};

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const STEPS: { key: StepKey; label: string; icon: typeof FileText }[] = [
  { key: "info", label: "Thông tin PO", icon: FileText },
  { key: "lines", label: "Dòng hàng", icon: Layers },
  { key: "totals", label: "Tổng cộng", icon: Package },
  { key: "review", label: "Gửi duyệt", icon: ClipboardCheck },
];

const INITIAL_FORM: FormState = {
  supplierId: "",
  warehouseId: "",
  orderDate: "2026-06-10",
  expectedDate: "",
  currency: "VND",
  paymentTerms: "",
  notes: "",
  lines: [],
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function parsePositiveNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function parseNonNegativeRate(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

function fieldClass(hasError = false) {
  return cn(
    "w-full rounded-[var(--r-sm)] border bg-bg-surface px-3 py-1.5 text-[0.8125rem] text-ink-primary outline-none transition-colors placeholder:text-ink-tertiary disabled:bg-bg-muted disabled:text-ink-tertiary",
    hasError ? "border-danger focus:border-danger" : "border-border-default focus:border-accent",
  );
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="text-danger mt-1 text-xs">{children}</p>;
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-ink-primary font-[family-name:var(--font-display)] text-[1rem] font-semibold">
        {title}
      </h2>
      <p className="text-ink-secondary mt-1 text-[0.8125rem]">{description}</p>
    </div>
  );
}

function createEmptyLine(): PoLineDraft {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    skuId: "",
    orderedQty: "1",
    unitPrice: "",
    taxRate: "0.08",
    discountRate: "0",
    uom: "",
  };
}

function lineSubtotal(line: PoLineDraft) {
  const qty = Number(line.orderedQty) || 0;
  const price = Number(line.unitPrice) || 0;
  return qty * price;
}

function lineTax(line: PoLineDraft) {
  return lineSubtotal(line) * (Number(line.taxRate) || 0);
}

function lineDiscount(line: PoLineDraft) {
  return lineSubtotal(line) * (Number(line.discountRate) || 0);
}

function lineTotal(line: PoLineDraft) {
  return lineSubtotal(line) - lineDiscount(line) + lineTax(line);
}

function calculateTotals(lines: PoLineDraft[]): Totals {
  return lines.reduce(
    (acc, line) => {
      acc.subtotal += lineSubtotal(line);
      acc.taxTotal += lineTax(line);
      acc.discountTotal += lineDiscount(line);
      acc.grandTotal += lineTotal(line);
      return acc;
    },
    { subtotal: 0, taxTotal: 0, discountTotal: 0, grandTotal: 0 },
  );
}

function validateForm(form: FormState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!form.supplierId) issues.push({ step: "info", message: "Nhà cung cấp là bắt buộc." });
  if (!form.warehouseId) issues.push({ step: "info", message: "Kho nhận là bắt buộc." });
  if (!form.orderDate) issues.push({ step: "info", message: "Ngày đặt là bắt buộc." });
  if (!form.expectedDate) issues.push({ step: "info", message: "Ngày giao dự kiến là bắt buộc." });

  if (form.lines.length === 0) {
    issues.push({ step: "lines", message: "Cần ít nhất một dòng hàng." });
  }

  const seenSkuIds = new Set<string>();
  for (const line of form.lines) {
    if (!line.skuId) {
      issues.push({ step: "lines", message: "Mỗi dòng hàng cần chọn SKU." });
      continue;
    }
    if (seenSkuIds.has(line.skuId)) {
      issues.push({ step: "lines", message: `SKU ${line.skuId} bị trùng trong PO.` });
    }
    seenSkuIds.add(line.skuId);
    if (!parsePositiveNumber(line.orderedQty)) {
      issues.push({ step: "lines", message: `SKU ${line.skuId}: SL đặt phải lớn hơn 0.` });
    }
    if (!parsePositiveNumber(line.unitPrice)) {
      issues.push({ step: "lines", message: `SKU ${line.skuId}: Đơn giá phải lớn hơn 0.` });
    }
    if (!parseNonNegativeRate(line.taxRate)) {
      issues.push({ step: "lines", message: `SKU ${line.skuId}: Thuế không được âm.` });
    }
    if (!parseNonNegativeRate(line.discountRate)) {
      issues.push({ step: "lines", message: `SKU ${line.skuId}: Chiết khấu không được âm.` });
    }
  }

  return issues;
}

function isExpectedDatePast(expectedDate: string) {
  return expectedDate !== "" && expectedDate < INITIAL_FORM.orderDate;
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export function PurchaseOrderCreate() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [currentStep, setCurrentStep] = useState<StepKey>("info");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const suppliersQuery = usePoSuppliers({});
  const warehousesQuery = usePoWarehouses({});
  const skusQuery = useSkus({ page: 1, pageSize: PAGE_SIZE.masterData });
  const purchaseOrdersQuery = usePurchaseOrders({ page: 1, pageSize: PAGE_SIZE.masterData });

  const suppliers = useMemo(() => suppliersQuery.data?.items ?? [], [suppliersQuery.data]);
  const warehouses = useMemo(() => warehousesQuery.data?.items ?? [], [warehousesQuery.data]);
  const skus = useMemo(() => skusQuery.data?.items ?? [], [skusQuery.data]);
  const purchaseOrders = useMemo(
    () => purchaseOrdersQuery.data?.items ?? [],
    [purchaseOrdersQuery.data],
  );
  const isLoading =
    suppliersQuery.isLoading ||
    warehousesQuery.isLoading ||
    skusQuery.isLoading ||
    purchaseOrdersQuery.isLoading;

  const activeSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.active),
    [suppliers],
  );
  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.active),
    [warehouses],
  );
  const activeSkus = useMemo(() => skus.filter((sku) => sku.status === "Active"), [skus]);

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.supplierId === form.supplierId),
    [form.supplierId, suppliers],
  );
  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.warehouseId === form.warehouseId),
    [form.warehouseId, warehouses],
  );
  const totals = useMemo(() => calculateTotals(form.lines), [form.lines]);
  const validationIssues = useMemo(() => validateForm(form), [form]);
  const issuesByStep = useMemo(() => {
    const map = new Map<StepKey, string[]>();
    for (const issue of validationIssues) {
      map.set(issue.step, [...(map.get(issue.step) ?? []), issue.message]);
    }
    return map;
  }, [validationIssues]);

  const currentStepIndex = STEPS.findIndex((step) => step.key === currentStep);
  const currentStepIssues = issuesByStep.get(currentStep) ?? [];
  const showErrors = submitAttempted || currentStep === "review";
  const displayCurrency = form.currency || selectedSupplier?.currency || "VND";

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateLine = (lineId: string, patch: Partial<PoLineDraft>) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
    }));
  };

  const handleSupplierChange = (supplierId: string) => {
    const supplier = suppliers.find((item) => item.supplierId === supplierId);
    setForm((prev) => ({
      ...prev,
      supplierId,
      currency: supplier?.currency ?? "VND",
      paymentTerms: supplier?.paymentTerms ?? "",
    }));
  };

  const handleSkuChange = (lineId: string, skuId: string) => {
    const sku = skus.find((item) => item.skuId === skuId);
    updateLine(lineId, {
      skuId,
      unitPrice: sku ? String(sku.cost) : "",
      uom: sku?.uom ?? "",
    });
  };

  const addLine = () => {
    update("lines", [...form.lines, createEmptyLine()]);
  };

  const removeLine = (lineId: string) => {
    update(
      "lines",
      form.lines.filter((line) => line.id !== lineId),
    );
  };

  const goNext = () => setCurrentStep(STEPS[Math.min(currentStepIndex + 1, STEPS.length - 1)]!.key);
  const goBack = () => setCurrentStep(STEPS[Math.max(currentStepIndex - 1, 0)]!.key);

  const handleSubmitAttempt = () => {
    setSubmitAttempted(true);
    if (validationIssues.length > 0) {
      const first = validationIssues[0]!;
      setCurrentStep(first.step);
      toast.error("Chưa thể gửi duyệt", first.message);
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmSubmit = () => {
    setSubmitted(true);
    setConfirmOpen(false);
    setCurrentStep("review");
    toast.success("Đã gửi duyệt", "PO mock đã chuyển sang Pending Approval trong UI.");
  };

  const stepStatus = (step: StepKey) => {
    if ((issuesByStep.get(step) ?? []).length > 0 && submitAttempted) return "error";
    if (STEPS.findIndex((s) => s.key === step) < currentStepIndex || submitted) return "done";
    if (step === currentStep) return "active";
    return "idle";
  };

  if (isLoading) {
    return <PageSkeleton variant="form" />;
  }

  return (
    <>
      <PageHeader
        title="Tạo đơn đặt hàng"
        subtitle="Khai báo Purchase Order từ nhà cung cấp, thêm dòng SKU và gửi vào luồng duyệt."
        actions={
          <Link
            href={ADMIN_ROUTES.purchaseOrders.list}
            className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Quay lại danh sách
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
        <Card className="h-fit p-0">
          <div className="border-border-default border-b px-4 py-3">
            <div className="text-ink-tertiary text-xs font-semibold tracking-[0.08em] uppercase">
              Quy trình
            </div>
            <div className="mt-1 flex items-center gap-2">
              <StatusDot
                domain="po"
                status={submitted ? "Pending Approval" : "Draft"}
                size="sm"
                withIcon
              />
              <span className="text-ink-tertiary text-xs">{form.lines.length} dòng hàng</span>
            </div>
          </div>
          <div className="p-2">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const status = stepStatus(step.key);
              return (
                <Button
                  key={step.key}
                  type="button"
                  variant="ghost"
                  onClick={() => setCurrentStep(step.key)}
                  className={cn(
                    "mb-1 flex w-full justify-start gap-2 rounded-[var(--r-sm)] px-2.5 py-2 text-left text-[0.8125rem] transition-colors",
                    status === "active" &&
                      "bg-brand text-ink-inverse hover:bg-brand hover:text-ink-inverse font-medium",
                    status !== "active" &&
                      "text-ink-secondary hover:bg-bg-muted hover:text-ink-primary",
                    status === "error" && "border-danger/30 bg-danger/5 text-danger border",
                  )}
                >
                  <span className="flex size-5 items-center justify-center rounded-full border border-current/20 text-[0.625rem]">
                    {status === "done" ? <Check className="size-3" /> : index + 1}
                  </span>
                  <Icon className="size-3.5" />
                  <span className="flex-1">{step.label}</span>
                </Button>
              );
            })}
          </div>
        </Card>

        <div className="min-w-0 space-y-4 pb-24">
          {showErrors && currentStepIssues.length > 0 && (
            <div className="border-danger/30 bg-danger/5 text-danger rounded-[var(--r-sm)] border px-4 py-3 text-[0.8125rem]">
              <div className="font-semibold">Cần xử lý trước khi gửi duyệt</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {currentStepIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {currentStep === "info" && (
            <InfoStep
              form={form}
              activeSuppliers={activeSuppliers}
              activeWarehouses={activeWarehouses}
              selectedSupplier={selectedSupplier}
              showErrors={showErrors}
              onSupplierChange={handleSupplierChange}
              update={update}
            />
          )}
          {currentStep === "lines" && (
            <LinesStep
              form={form}
              activeSkus={activeSkus}
              showErrors={showErrors}
              currency={displayCurrency}
              onAddLine={addLine}
              onRemoveLine={removeLine}
              onSkuChange={handleSkuChange}
              updateLine={updateLine}
            />
          )}
          {currentStep === "totals" && (
            <TotalsStep totals={totals} currency={displayCurrency} lines={form.lines} />
          )}
          {currentStep === "review" && (
            <ReviewStep
              form={form}
              selectedSupplier={selectedSupplier}
              selectedWarehouse={selectedWarehouse}
              totals={totals}
              currency={displayCurrency}
              issuesByStep={issuesByStep}
              submitted={submitted}
              purchaseOrders={purchaseOrders}
              onSubmit={handleSubmitAttempt}
            />
          )}
        </div>
      </div>

      <div className="border-border-default bg-bg-surface/95 fixed right-0 bottom-0 left-0 z-40 border-t px-4 py-3 backdrop-blur lg:left-[240px]">
        <div className="flex items-center justify-between gap-3">
          <div className="text-ink-tertiary text-xs">
            Bước {currentStepIndex + 1}/{STEPS.length} · {STEPS[currentStepIndex]?.label}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                toast.success(
                  "Đã lưu nháp",
                  "Dữ liệu PO mock được giữ trong phiên làm việc hiện tại.",
                );
              }}
              className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
            >
              <Save className="size-3.5" />
              Lưu nháp
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goBack}
              disabled={currentStepIndex === 0}
              className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors disabled:opacity-40"
            >
              Quay lại
            </Button>
            {currentStep !== "review" ? (
              <Button
                variant="default"
                type="button"
                size="sm"
                onClick={goNext}
                className="bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse inline-flex items-center gap-1.5 rounded-[var(--r-sm)] px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
              >
                Tiếp tục
                <ArrowRight className="size-3.5" />
              </Button>
            ) : (
              <Button
                variant="default"
                type="button"
                size="sm"
                onClick={handleSubmitAttempt}
                className="bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse inline-flex items-center gap-1.5 rounded-[var(--r-sm)] px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
              >
                <Send className="size-3.5" />
                Gửi duyệt
              </Button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Gửi duyệt đơn đặt hàng"
        description={`Xác nhận gửi PO với ${form.lines.length} dòng hàng, tổng ${formatMoney(totals.grandTotal, displayCurrency)} vào hàng chờ duyệt?`}
        confirmLabel="Gửi duyệt"
        variant="default"
        onConfirm={handleConfirmSubmit}
      />
    </>
  );
}

function InfoStep({
  form,
  activeSuppliers,
  activeWarehouses,
  selectedSupplier,
  showErrors,
  onSupplierChange,
  update,
}: {
  form: FormState;
  activeSuppliers: Supplier[];
  activeWarehouses: Warehouse[];
  selectedSupplier?: Supplier;
  showErrors: boolean;
  onSupplierChange: (supplierId: string) => void;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <Card>
      <SectionTitle
        title="Thông tin PO"
        description="Chọn nhà cung cấp, kho nhận, ngày chứng từ và điều khoản thanh toán."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className="text-ink-secondary mb-1 block text-xs font-medium">
            Nhà cung cấp <span className="text-danger">*</span>
          </label>
          <Select value={form.supplierId} onValueChange={onSupplierChange}>
            <SelectTrigger
              size="default"
              aria-label="Nhà cung cấp"
              className={fieldClass(showErrors && !form.supplierId)}
            >
              <SelectValue placeholder="Chọn nhà cung cấp" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                <SelectLabel>Nhà cung cấp</SelectLabel>
                {activeSuppliers.map((supplier) => (
                  <SelectItem key={supplier.supplierId} value={supplier.supplierId}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldError>
            {showErrors && !form.supplierId ? "Nhà cung cấp là bắt buộc." : undefined}
          </FieldError>
        </div>
        <div>
          <label className="text-ink-secondary mb-1 block text-xs font-medium">
            Kho nhận <span className="text-danger">*</span>
          </label>
          <Select value={form.warehouseId} onValueChange={(value) => update("warehouseId", value)}>
            <SelectTrigger
              size="default"
              aria-label="Kho nhận"
              className={fieldClass(showErrors && !form.warehouseId)}
            >
              <SelectValue placeholder="Chọn kho nhận" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                <SelectLabel>Kho nhận</SelectLabel>
                {activeWarehouses.map((warehouse) => (
                  <SelectItem key={warehouse.warehouseId} value={warehouse.warehouseId}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldError>
            {showErrors && !form.warehouseId ? "Kho nhận là bắt buộc." : undefined}
          </FieldError>
        </div>
        <div>
          <label className="text-ink-secondary mb-1 block text-xs font-medium">
            Ngày đặt <span className="text-danger">*</span>
          </label>
          <Input
            type="date"
            value={form.orderDate}
            onChange={(e) => update("orderDate", e.target.value)}
            className={fieldClass(showErrors && !form.orderDate)}
          />
          <FieldError>
            {showErrors && !form.orderDate ? "Ngày đặt là bắt buộc." : undefined}
          </FieldError>
        </div>
        <div>
          <label className="text-ink-secondary mb-1 block text-xs font-medium">
            Ngày giao dự kiến <span className="text-danger">*</span>
          </label>
          <Input
            type="date"
            value={form.expectedDate}
            onChange={(e) => update("expectedDate", e.target.value)}
            className={fieldClass(showErrors && !form.expectedDate)}
          />
          <FieldError>
            {showErrors && !form.expectedDate ? "Ngày giao dự kiến là bắt buộc." : undefined}
          </FieldError>
          {isExpectedDatePast(form.expectedDate) && (
            <div className="border-warning/30 bg-warning/10 text-warning mt-2 rounded-[var(--r-sm)] border px-3 py-2 text-xs">
              Ngày giao dự kiến đang nằm trước ngày đặt. Cảnh báo này không chặn gửi duyệt.
            </div>
          )}
        </div>
        <div>
          <label
            htmlFor="poc-n-v-ti-n-t"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            Đơn vị tiền tệ
          </label>

          <Input
            id="poc-n-v-ti-n-t"
            value={form.currency || selectedSupplier?.currency || "VND"}
            readOnly
            className={fieldClass()}
          />
        </div>
        <div>
          <label className="text-ink-secondary mb-1 block text-xs font-medium">
            Điều khoản thanh toán
          </label>
          <Input
            value={form.paymentTerms}
            onChange={(e) => update("paymentTerms", e.target.value)}
            placeholder="Net 30"
            className={fieldClass()}
          />
        </div>
        <div className="lg:col-span-2">
          <label className="text-ink-secondary mb-1 block text-xs font-medium">Ghi chú</label>
          <Textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={3}
            placeholder="Ghi chú nội bộ cho buyer / approver..."
            className={fieldClass()}
          />
        </div>
      </div>
    </Card>
  );
}

function LinesStep({
  form,
  activeSkus,
  showErrors,
  currency,
  onAddLine,
  onRemoveLine,
  onSkuChange,
  updateLine,
}: {
  form: FormState;
  activeSkus: Sku[];
  showErrors: boolean;
  currency: Currency;
  onAddLine: () => void;
  onRemoveLine: (lineId: string) => void;
  onSkuChange: (lineId: string, skuId: string) => void;
  updateLine: (lineId: string, patch: Partial<PoLineDraft>) => void;
}) {
  const duplicateSkuIds = new Set<string>();
  const seenSkuIds = new Set<string>();
  for (const line of form.lines) {
    if (!line.skuId) continue;
    if (seenSkuIds.has(line.skuId)) duplicateSkuIds.add(line.skuId);
    seenSkuIds.add(line.skuId);
  }
  const totals = calculateTotals(form.lines);

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <SectionTitle
          title="Dòng hàng"
          description="Thêm SKU Active, số lượng đặt, đơn giá, thuế và chiết khấu theo từng dòng."
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddLine}
          className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
        >
          <Plus className="size-3.5" />
          Thêm dòng hàng
        </Button>
      </div>

      {form.lines.length === 0 ? (
        <div
          className={cn(
            "rounded-[var(--r-sm)] border px-4 py-8 text-center text-[0.8125rem]",
            showErrors
              ? "border-danger/30 bg-danger/5 text-danger"
              : "border-border-default bg-bg-subtle text-ink-tertiary",
          )}
        >
          Chưa có dòng hàng. Cần ít nhất một dòng trước khi gửi duyệt.
        </div>
      ) : (
        <div className="space-y-3">
          {form.lines.map((line, index) => {
            const selectedSku = activeSkus.find((sku) => sku.skuId === line.skuId);
            const hasDuplicate = line.skuId !== "" && duplicateSkuIds.has(line.skuId);
            return (
              <div
                key={line.id}
                className={cn(
                  "bg-bg-subtle rounded-[var(--r-sm)] border p-3",
                  hasDuplicate ? "border-danger/30" : "border-border-default",
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-brand text-ink-inverse flex size-6 items-center justify-center rounded-full text-xs font-medium">
                      {index + 1}
                    </span>
                    <div>
                      <div className="text-ink-primary text-[0.8125rem] font-medium">
                        Dòng hàng {index + 1}
                      </div>
                      <div className="text-ink-tertiary text-xs">
                        {selectedSku?.variantLabel ?? "Chưa chọn SKU"}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => onRemoveLine(line.id)}
                    className="border-danger/30 text-danger hover:bg-danger/10 flex size-8 items-center justify-center rounded-[var(--r-sm)] border transition-colors"
                    aria-label="Xóa dòng hàng"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.4fr)_100px_130px_100px_120px_80px_140px]">
                  <div>
                    <label className="text-ink-secondary mb-1 block text-xs font-medium">
                      SKU <span className="text-danger">*</span>
                    </label>
                    <Select
                      value={line.skuId}
                      onValueChange={(value) => onSkuChange(line.id, value)}
                    >
                      <SelectTrigger
                        size="default"
                        aria-label={`SKU dòng ${index + 1}`}
                        className={fieldClass(showErrors && (!line.skuId || hasDuplicate))}
                      >
                        <SelectValue placeholder="Chọn SKU" />
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectGroup>
                          <SelectLabel>SKU dòng {index + 1}</SelectLabel>
                          {activeSkus.map((sku) => (
                            <SelectItem key={sku.skuId} value={sku.skuId}>
                              {sku.skuId} — {sku.variantLabel}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {hasDuplicate && <FieldError>SKU bị trùng trong PO.</FieldError>}
                  </div>
                  <div>
                    <label className="text-ink-secondary mb-1 block text-xs font-medium">
                      SL đặt <span className="text-danger">*</span>
                    </label>
                    <Input
                      value={line.orderedQty}
                      onChange={(e) => updateLine(line.id, { orderedQty: e.target.value })}
                      type="number"
                      min={1}
                      inputMode="numeric"
                      className={cn(
                        fieldClass(showErrors && !parsePositiveNumber(line.orderedQty)),
                        "text-right tabular-nums",
                      )}
                    />
                  </div>
                  <div>
                    <label className="text-ink-secondary mb-1 block text-xs font-medium">
                      Đơn giá <span className="text-danger">*</span>
                    </label>
                    <Input
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.id, { unitPrice: e.target.value })}
                      type="number"
                      min={1}
                      inputMode="decimal"
                      className={cn(
                        fieldClass(showErrors && !parsePositiveNumber(line.unitPrice)),
                        "text-right tabular-nums",
                      )}
                    />
                  </div>
                  <div>
                    <label className="text-ink-secondary mb-1 block text-xs font-medium">
                      Thuế (%)
                    </label>
                    <Input
                      value={String((Number(line.taxRate) || 0) * 100)}
                      onChange={(e) =>
                        updateLine(line.id, {
                          taxRate: String((Number(e.target.value) || 0) / 100),
                        })
                      }
                      type="number"
                      min={0}
                      inputMode="decimal"
                      className={cn(
                        fieldClass(!parseNonNegativeRate(line.taxRate)),
                        "text-right tabular-nums",
                      )}
                    />
                  </div>
                  <div>
                    <label className="text-ink-secondary mb-1 block text-xs font-medium">
                      Chiết khấu (%)
                    </label>
                    <Input
                      value={String((Number(line.discountRate) || 0) * 100)}
                      onChange={(e) =>
                        updateLine(line.id, {
                          discountRate: String((Number(e.target.value) || 0) / 100),
                        })
                      }
                      type="number"
                      min={0}
                      inputMode="decimal"
                      className={cn(
                        fieldClass(!parseNonNegativeRate(line.discountRate)),
                        "text-right tabular-nums",
                      )}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="poc-uom"
                      className="text-ink-secondary mb-1 block text-xs font-medium"
                    >
                      UoM
                    </label>

                    <Input id="poc-uom" value={line.uom} readOnly className={fieldClass()} />
                  </div>
                  <div>
                    <label
                      htmlFor="poc-th-nh-ti-n"
                      className="text-ink-secondary mb-1 block text-xs font-medium"
                    >
                      Thành tiền
                    </label>

                    <Input
                      id="poc-th-nh-ti-n"
                      value={formatMoney(lineTotal(line), currency)}
                      readOnly
                      className={cn(fieldClass(), "text-right tabular-nums")}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="border-border-default mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3">
        <SummaryItem label="Số dòng" value={String(form.lines.length)} mono />
        <SummaryItem label="Tạm tính" value={formatMoney(totals.subtotal, currency)} mono />
        <SummaryItem label="Tổng dòng hàng" value={formatMoney(totals.grandTotal, currency)} mono />
      </div>
    </Card>
  );
}

function TotalsStep({
  totals,
  currency,
  lines,
}: {
  totals: Totals;
  currency: Currency;
  lines: PoLineDraft[];
}) {
  return (
    <Card>
      <SectionTitle
        title="Tổng cộng"
        description="Tổng giá trị PO được tính từ số lượng, đơn giá, thuế và chiết khấu của các dòng hàng."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryItem
          label="Tạm tính (Subtotal)"
          value={formatMoney(totals.subtotal, currency)}
          mono
        />
        <SummaryItem label="Thuế" value={formatMoney(totals.taxTotal, currency)} mono />
        <SummaryItem label="Chiết khấu" value={formatMoney(totals.discountTotal, currency)} mono />
        <div className="border-accent/40 bg-accent/5 rounded-[var(--r-sm)] border px-3 py-2">
          <div className="text-ink-tertiary text-xs">Tổng giá trị PO</div>
          <div className="text-accent mt-1 truncate font-[family-name:var(--font-mono)] text-[1rem] font-semibold tabular-nums">
            {formatMoney(totals.grandTotal, currency)}
          </div>
        </div>
      </div>
      <div className="border-border-default mt-5 rounded-[var(--r-sm)] border">
        {lines.length === 0 ? (
          <div className="text-ink-tertiary px-3 py-6 text-center text-[0.8125rem]">
            Chưa có dòng hàng để tính tổng.
          </div>
        ) : (
          lines.map((line) => (
            <div
              key={line.id}
              className="border-border-default grid gap-2 border-b px-3 py-2 text-[0.8125rem] last:border-b-0 md:grid-cols-[1fr_90px_120px_120px]"
            >
              <div className="min-w-0">
                <div className="text-ink-primary truncate font-medium">
                  {line.skuId || "Chưa chọn SKU"}
                </div>
                <div className="text-ink-tertiary text-xs">
                  Thuế {(Number(line.taxRate) * 100).toFixed(0)}% · CK{" "}
                  {(Number(line.discountRate) * 100).toFixed(0)}%
                </div>
              </div>
              <div className="text-ink-secondary text-right font-[family-name:var(--font-mono)] tabular-nums">
                {line.orderedQty || "0"} {line.uom}
              </div>
              <div className="text-ink-secondary text-right font-[family-name:var(--font-mono)] tabular-nums">
                {formatMoney(Number(line.unitPrice) || 0, currency)}
              </div>
              <div className="text-ink-primary text-right font-[family-name:var(--font-mono)] font-medium tabular-nums">
                {formatMoney(lineTotal(line), currency)}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function ReviewStep({
  form,
  selectedSupplier,
  selectedWarehouse,
  totals,
  currency,
  issuesByStep,
  submitted,
  purchaseOrders,
  onSubmit,
}: {
  form: FormState;
  selectedSupplier?: Supplier;
  selectedWarehouse?: Warehouse;
  totals: Totals;
  currency: Currency;
  issuesByStep: Map<StepKey, string[]>;
  submitted: boolean;
  purchaseOrders: readonly { poNumber: string }[];
  onSubmit: () => void;
}) {
  const duplicatePoNumber = purchaseOrders.some((po) => po.poNumber === "PO-NEW-DRAFT");

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <SectionTitle
          title="Rà soát trước khi gửi duyệt"
          description="Tổng hợp PO và checklist validation trước khi chuyển sang Pending Approval."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryItem label="Nhà cung cấp" value={selectedSupplier?.name ?? "—"} />
          <SummaryItem label="Kho nhận" value={selectedWarehouse?.name ?? "—"} />
          <SummaryItem label="Ngày đặt" value={form.orderDate || "—"} mono />
          <SummaryItem label="Ngày giao dự kiến" value={form.expectedDate || "—"} mono />
          <SummaryItem label="Điều khoản" value={form.paymentTerms || "—"} />
          <SummaryItem label="Số dòng" value={String(form.lines.length)} mono />
          <SummaryItem label="Tiền tệ" value={currency} mono />
          <SummaryItem label="Tổng PO" value={formatMoney(totals.grandTotal, currency)} mono />
          <SummaryItem
            label="PO number preview"
            value={duplicatePoNumber ? "PO-NEW-DRAFT trùng" : "PO-NEW-DRAFT"}
            mono
          />
        </div>

        <div className="border-border-default mt-5 rounded-[var(--r-sm)] border">
          {STEPS.map((step) => {
            const issues = issuesByStep.get(step.key) ?? [];
            return (
              <div
                key={step.key}
                className="border-border-default flex items-start gap-3 border-b px-3 py-2 last:border-b-0"
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-5 items-center justify-center rounded-full",
                    issues.length ? "bg-danger/10 text-danger" : "bg-positive/10 text-positive",
                  )}
                >
                  {issues.length ? <X className="size-3" /> : <CheckCircle className="size-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-ink-primary text-[0.8125rem] font-medium">{step.label}</div>
                  {issues.length ? (
                    <div className="text-danger mt-0.5 text-xs">{issues.join(" · ")}</div>
                  ) : (
                    <div className="text-ink-tertiary mt-0.5 text-xs">Sẵn sàng</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="h-fit">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-ink-tertiary text-xs font-medium tracking-[0.08em] uppercase">
              Lifecycle
            </div>
            <div className="mt-1 flex items-center gap-2">
              <StatusDot domain="po" status={submitted ? "Pending Approval" : "Draft"} withIcon />
            </div>
          </div>
          <Settings2 className="text-accent size-5" />
        </div>
        <div className="border-border-default bg-bg-subtle text-ink-secondary rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem]">
          <div className="text-ink-primary mb-1 flex items-center gap-2 font-medium">
            <ShoppingCart className="text-accent size-3.5" />
            Draft → Pending Approval
          </div>
          `Gửi duyệt` chỉ cập nhật trạng thái preview trong UI. Không có API call và không thêm
          record vào mock data.
        </div>
        <Button
          variant="default"
          type="button"
          size="sm"
          onClick={onSubmit}
          className="bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--r-sm)] px-3 py-2 text-[0.8125rem] font-medium transition-colors"
        >
          <Send className="size-3.5" />
          Gửi duyệt
        </Button>
      </Card>
    </div>
  );
}

function SummaryItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border px-3 py-2">
      <div className="text-ink-tertiary text-xs">{label}</div>
      <div
        className={cn(
          "text-ink-primary mt-1 truncate text-[0.8125rem] font-medium",
          mono && "font-[family-name:var(--font-mono)] tabular-nums",
        )}
      >
        {value}
      </div>
    </div>
  );
}
