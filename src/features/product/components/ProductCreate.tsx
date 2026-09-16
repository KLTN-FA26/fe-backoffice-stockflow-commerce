"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  CheckCircle,
  ClipboardCheck,
  FileText,
  Image as ImageIcon,
  Layers,
  Package,
  Palette,
  Plus,
  Printer,
  Save,
  Send,
  Settings2,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";

import { ADMIN_ROUTES, PAGE_SIZE } from "@/constants";
import { ApiError } from "@/lib/api";
import { useCan } from "@/lib/auth/components/Can";

import {
  attributesForProducts,
  buildCreateProductInput,
  mapCreateProductError,
  useCategories,
  useCreateProduct,
  useProducts,
  useSkus,
  type CreateProductServerField,
  type CreateProductServerErrors,
  type ProductCreateFormSnapshot,
} from "@/features/product";

import { Card } from "@/components/shared/Card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusDot } from "@/components/shared/StatusDot";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

import type { Category, ProductAttribute, ProductType, Sku, Uom } from "@/features/product";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type StepKey =
  "draft" | "variants" | "sku" | "logistics" | "inventory" | "customization" | "catalog" | "review";

type TaxClass = "standard" | "reduced" | "exempt";

type FormState = ProductCreateFormSnapshot & {
  selectedAttributeIds: string[];
  selectedValues: Record<string, string[]>;
  disabledSkuKeys: string[];
  skuOverrides: Record<string, string>;
  skuCosts: Record<string, string>;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  packSize: string;
  lotTracking: boolean;
  serialTracking: boolean;
  expiryTracking: boolean;
  reorderPoint: string;
  maxStock: string;
  templateName: string;
  seoTitle: string;
  seoDescription: string;
  catalogVisible: boolean;
};

type PrintAreaDraft = {
  id: string;
  name: string;
  position: "front" | "back" | "left-sleeve" | "right-sleeve" | "full";
  widthMm: string;
  heightMm: string;
  minDpi: string;
};

type SkuPreviewRow = {
  key: string;
  enabled: boolean;
  skuCode: string;
  attributes: Record<string, string>;
  variantLabel: string;
};

type ValidationIssue = {
  step: StepKey;
  message: string;
};

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const STEPS: { key: StepKey; label: string; icon: typeof Box }[] = [
  { key: "draft", label: "Bản nháp", icon: FileText },
  { key: "variants", label: "Biến thể", icon: Palette },
  { key: "sku", label: "Ma trận SKU", icon: Layers },
  { key: "logistics", label: "Logistics", icon: Package },
  { key: "inventory", label: "Tồn kho", icon: Warehouse },
  { key: "customization", label: "Tùy chỉnh", icon: Printer },
  { key: "catalog", label: "TMĐT", icon: ImageIcon },
  { key: "review", label: "Rà soát", icon: ClipboardCheck },
];

const PRINT_POSITIONS = [
  { value: "front", label: "Mặt trước" },
  { value: "back", label: "Mặt sau" },
  { value: "left-sleeve", label: "Tay trái" },
  { value: "right-sleeve", label: "Tay phải" },
  { value: "full", label: "Toàn bộ" },
] as const;

const PRINT_TECHNIQUES = ["DTG", "DTF", "Screen", "Embroidery", "Sublimation"];

const INITIAL_FORM: FormState = {
  productCode: "",
  name: "",
  nameEn: "",
  type: "Standard",
  categoryId: "",
  brand: "",
  taxClass: "standard",
  uom: "pcs",
  description: "",
  descriptionEn: "",
  selectedAttributeIds: [],
  selectedValues: {},
  disabledSkuKeys: [],
  skuOverrides: {},
  skuCosts: {},
  weightKg: "",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
  packSize: "1",
  lotTracking: false,
  serialTracking: false,
  expiryTracking: false,
  reorderPoint: "0",
  maxStock: "",
  printAreas: [],
  model3dUrl: "",
  templateName: "",
  allowedTechniques: ["DTG", "DTF"],
  imageUrls: "",
  seoTitle: "",
  seoDescription: "",
  catalogVisible: false,
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_-]/g, "");
}

function valueCode(value: string) {
  const dictionary: Record<string, string> = {
    Đen: "DEN",
    Trắng: "TRG",
    Xám: "XAM",
    Navy: "NVY",
    "Đen lông": "DLG",
    Be: "BE",
    "Be tự nhiên": "BTN",
  };
  return (dictionary[value] ?? normalizeCode(value).slice(0, 3)) || "VAR";
}

function cartesianProduct(entries: { attr: ProductAttribute; values: string[] }[]) {
  if (entries.length === 0) return [{ key: "DEFAULT", attributes: {} as Record<string, string> }];
  return entries.reduce(
    (acc, entry) =>
      acc.flatMap((row) =>
        entry.values.map((value) => ({
          key: `${row.key}|${entry.attr.attributeId}:${value}`,
          attributes: { ...row.attributes, [entry.attr.name.en]: value },
        })),
      ),
    [{ key: "", attributes: {} as Record<string, string> }],
  );
}

function parsePositiveNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function parseNonNegativeNumber(value: string) {
  if (value.trim() === "") return true;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

function fieldClass(hasError = false) {
  return cn(
    "w-full rounded-[var(--r-sm)] border-border-default bg-bg-surface text-[0.8125rem] text-ink-primary shadow-none placeholder:text-ink-tertiary focus-visible:border-brand focus-visible:ring-brand/20",
    hasError && "border-danger focus-visible:border-danger focus-visible:ring-danger/20",
  );
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="text-danger mt-1 text-xs">{children}</p>;
}

function serverFieldForFormKey(key: keyof FormState): CreateProductServerField | null {
  switch (key) {
    case "allowedTechniques":
    case "printAreas":
      return "printAreas";
    case "imageUrls":
      return "images";
    case "selectedAttributeIds":
    case "selectedValues":
      return "attributes";
    case "brand":
    case "categoryId":
    case "description":
    case "descriptionEn":
    case "model3dUrl":
    case "name":
    case "nameEn":
    case "productCode":
    case "taxClass":
    case "type":
    case "uom":
      return key;
    default:
      return null;
  }
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

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export function ProductCreate() {
  const router = useRouter();
  const canCreateProduct = useCan("product.create");
  const productsQuery = useProducts({ page: 1, pageSize: PAGE_SIZE.masterData });
  const skusQuery = useSkus({ page: 1, pageSize: PAGE_SIZE.masterData });
  const categoriesQuery = useCategories({});

  const products = useMemo(() => productsQuery.data?.items ?? [], [productsQuery.data]);
  const skus = useMemo(() => skusQuery.data?.items ?? [], [skusQuery.data]);
  const categories = useMemo(() => categoriesQuery.data?.items ?? [], [categoriesQuery.data]);
  const attributes = useMemo(() => attributesForProducts(products), [products]);
  const isLoading = productsQuery.isLoading || skusQuery.isLoading || categoriesQuery.isLoading;
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [currentStep, setCurrentStep] = useState<StepKey>("draft");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<CreateProductServerErrors>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const createProductMutation = useCreateProduct({
    onSuccess: (product) => {
      setSubmitted(true);
      setCreatedProductId(product.productId);
      setServerErrors({});
      setServerMessage(null);
      setConfirmOpen(false);
      setCurrentStep("review");
    },
    onError: (error) => {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError(0, "UNKNOWN_ERROR", "Không tạo được sản phẩm.");
      const mapped = mapCreateProductError(apiError);
      setServerErrors(mapped.fieldErrors);
      setServerMessage(mapped.message);
      setConfirmOpen(false);
      setSubmitAttempted(true);
      if (mapped.fieldErrors.productCode || mapped.fieldErrors.name || mapped.fieldErrors.brand) {
        setCurrentStep("draft");
      } else if (mapped.fieldErrors.categoryId) {
        setCurrentStep("draft");
      } else if (mapped.fieldErrors.attributes) {
        setCurrentStep("variants");
      } else if (mapped.fieldErrors.printAreas) {
        setCurrentStep("customization");
      }
    },
  });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    const serverField = serverFieldForFormKey(key);
    if (serverField) {
      setServerErrors((prev) => ({ ...prev, [serverField]: undefined }));
    }
    if (serverMessage) setServerMessage(null);
  };

  const selectedEntries = useMemo(
    () =>
      form.selectedAttributeIds
        .map((id) => {
          const attr = attributes.find((a) => a.attributeId === id);
          if (!attr) return null;
          return { attr, values: form.selectedValues[id] ?? [] };
        })
        .filter((entry): entry is { attr: ProductAttribute; values: string[] } => !!entry),
    [attributes, form.selectedAttributeIds, form.selectedValues],
  );

  const skuRows = useMemo<SkuPreviewRow[]>(() => {
    const combinations = cartesianProduct(
      selectedEntries.filter((entry) => entry.values.length > 0),
    );
    const productCode = normalizeCode(form.productCode) || "NEW-PRODUCT";
    return combinations.map((combo, index) => {
      const parts = Object.values(combo.attributes).map(valueCode);
      const autoCode = [productCode, ...parts, String(index + 1).padStart(3, "0")].join("-");
      const skuCode = form.skuOverrides[combo.key] ?? autoCode;
      const variantLabel = Object.keys(combo.attributes).length
        ? Object.values(combo.attributes).join(" / ")
        : "SKU mặc định";
      return {
        key: combo.key,
        enabled: !form.disabledSkuKeys.includes(combo.key),
        skuCode,
        attributes: combo.attributes,
        variantLabel,
      };
    });
  }, [form.disabledSkuKeys, form.productCode, form.skuOverrides, selectedEntries]);

  const enabledSkuRows = skuRows.filter((row) => row.enabled);
  const validationIssues = useMemo(
    () => validateForm(form, selectedEntries, skuRows, skus),
    [form, selectedEntries, skuRows, skus],
  );
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
    createProductMutation.mutate(buildCreateProductInput(form, selectedEntries));
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

  if (!canCreateProduct) {
    return (
      <>
        <PageHeader
          title="Tạo sản phẩm"
          subtitle="Khai báo product master data, sinh SKU từ biến thể và lưu bản nháp."
          actions={
            <Link
              href={ADMIN_ROUTES.products.list}
              className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Quay lại danh sách
            </Link>
          }
        />
        <EmptyState
          title="Bạn không có quyền tạo sản phẩm"
          description="Tài khoản hiện tại không có quyền product.create. Hãy đổi role phù hợp hoặc quay lại danh sách."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push(ADMIN_ROUTES.products.list)}
              className="rounded-[var(--r-sm)]"
            >
              Quay lại danh sách
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Tạo sản phẩm"
        subtitle="Khai báo product master data, sinh SKU từ biến thể và lưu bản nháp."
        actions={
          <Link
            href={ADMIN_ROUTES.products.list}
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
              <StatusDot domain="product" status="Draft" size="sm" withIcon />
              <span className="text-ink-tertiary text-xs">{enabledSkuRows.length} SKU preview</span>
            </div>
          </div>
          <div className="p-2">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const status = stepStatus(step.key);
              const isSkipped = step.key === "customization" && form.type === "Standard";
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
                    isSkipped && "opacity-55",
                  )}
                >
                  <span className="flex size-5 items-center justify-center rounded-full border border-current/20 text-[0.625rem]">
                    {status === "done" ? <Check className="size-3" /> : index + 1}
                  </span>
                  <Icon className="size-3.5" />
                  <span className="flex-1">{step.label}</span>
                  {isSkipped && <span className="text-[0.625rem]">Skip</span>}
                </Button>
              );
            })}
          </div>
        </Card>

        <div className="min-w-0 space-y-4 pb-24">
          {serverMessage && (
            <div className="border-danger/30 bg-danger/5 text-danger rounded-[var(--r-sm)] border px-4 py-3 text-[0.8125rem]">
              <div className="font-semibold">Không tạo được sản phẩm</div>
              <div className="mt-1">{serverMessage}</div>
            </div>
          )}

          {showErrors && currentStepIssues.length > 0 && (
            <div className="border-danger/30 bg-danger/5 text-danger rounded-[var(--r-sm)] border px-4 py-3 text-[0.8125rem]">
              <div className="font-semibold">Cần xử lý trước khi tạo bản nháp</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {currentStepIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {currentStep === "draft" && (
            <DraftStep
              form={form}
              update={update}
              showErrors={showErrors}
              categories={categories}
              serverErrors={serverErrors}
            />
          )}
          {currentStep === "variants" && (
            <VariantStep attributes={attributes} form={form} update={update} />
          )}
          {currentStep === "sku" && (
            <SkuStep form={form} update={update} skuRows={skuRows} existingSkus={skus} />
          )}
          {currentStep === "logistics" && (
            <LogisticsStep
              form={form}
              update={update}
              showErrors={showErrors}
              skuCount={enabledSkuRows.length}
            />
          )}
          {currentStep === "inventory" && <InventoryStep form={form} update={update} />}
          {currentStep === "customization" && (
            <CustomizationStep form={form} update={update} showErrors={showErrors} />
          )}
          {currentStep === "catalog" && <CatalogStep form={form} update={update} />}
          {currentStep === "review" && (
            <ReviewStep
              form={form}
              skuRows={enabledSkuRows}
              issuesByStep={issuesByStep}
              submitted={submitted}
              createdProductId={createdProductId}
              isSubmitting={createProductMutation.isPending}
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
                handleSubmitAttempt();
              }}
              disabled={createProductMutation.isPending || submitted}
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
                disabled={createProductMutation.isPending}
                className="bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse inline-flex items-center gap-1.5 rounded-[var(--r-sm)] px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
              >
                <Send className="size-3.5" />
                Tạo bản nháp
              </Button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Tạo bản nháp sản phẩm"
        description={`Xác nhận tạo bản nháp ${form.name || "sản phẩm mới"} với ${enabledSkuRows.length} SKU preview?`}
        confirmLabel={createProductMutation.isPending ? "Đang tạo..." : "Tạo bản nháp"}
        variant="default"
        onConfirm={handleConfirmSubmit}
      />
    </>
  );
}

function DraftStep({
  form,
  update,
  showErrors,
  categories,
  serverErrors,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  showErrors: boolean;
  categories: Category[];
  serverErrors: CreateProductServerErrors;
}) {
  return (
    <Card>
      <SectionTitle
        title="Thông tin bản nháp"
        description="Các trường định danh bắt buộc để khởi tạo Product record ở trạng thái Draft."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label
            htmlFor="pc-t-n-s-n-ph-m"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            Tên sản phẩm <span className="text-danger">*</span>
          </label>

          <Input
            id="pc-t-n-s-n-ph-m"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Áo thun cotton cao cấp"
            className={fieldClass(Boolean(serverErrors.name) || (showErrors && !form.name.trim()))}
          />
          <FieldError>
            {serverErrors.name ??
              (showErrors && !form.name.trim() ? "Tên sản phẩm là bắt buộc." : undefined)}
          </FieldError>
        </div>
        <div>
          <label
            htmlFor="pc-t-n-ti-ng-anh"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            Tên tiếng Anh
          </label>

          <Input
            id="pc-t-n-ti-ng-anh"
            value={form.nameEn}
            onChange={(e) => update("nameEn", e.target.value)}
            placeholder="Premium Cotton T-Shirt"
            className={fieldClass()}
          />
        </div>
        <div>
          <label
            htmlFor="pc-m-s-n-ph-m-n-i-b"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            Mã sản phẩm nội bộ <span className="text-danger">*</span>
          </label>

          <Input
            id="pc-m-s-n-ph-m-n-i-b"
            value={form.productCode}
            onChange={(e) => update("productCode", normalizeCode(e.target.value))}
            placeholder="TEE-COTTON"
            className={fieldClass(
              Boolean(serverErrors.productCode) || (showErrors && !form.productCode.trim()),
            )}
          />
          <FieldError>
            {serverErrors.productCode ??
              (showErrors && !form.productCode.trim() ? "Mã sản phẩm là bắt buộc." : undefined)}
          </FieldError>
        </div>
        <div>
          <label className="text-ink-secondary mb-1 block text-xs font-medium">
            Danh mục <span className="text-danger">*</span>
          </label>
          <Select value={form.categoryId} onValueChange={(value) => update("categoryId", value)}>
            <SelectTrigger
              size="default"
              aria-label="Danh mục"
              className={fieldClass(
                Boolean(serverErrors.categoryId) || (showErrors && !form.categoryId),
              )}
            >
              <SelectValue placeholder="Chọn danh mục" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                <SelectLabel>Danh mục</SelectLabel>
                {categories.map((category: Category) => (
                  <SelectItem key={category.categoryId} value={category.categoryId}>
                    {"— ".repeat(category.level - 1)}
                    {category.name.vi} · {category.categoryId}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldError>
            {serverErrors.categoryId ??
              (showErrors && !form.categoryId ? "Danh mục là bắt buộc." : undefined)}
          </FieldError>
        </div>
        <div>
          <label
            htmlFor="pc-th-ng-hi-u"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            Thương hiệu <span className="text-danger">*</span>
          </label>

          <Input
            id="pc-th-ng-hi-u"
            value={form.brand}
            onChange={(e) => update("brand", e.target.value)}
            placeholder="StockFlow Basics"
            className={fieldClass(
              Boolean(serverErrors.brand) || (showErrors && !form.brand.trim()),
            )}
          />
          <FieldError>
            {serverErrors.brand ??
              (showErrors && !form.brand.trim() ? "Thương hiệu là bắt buộc." : undefined)}
          </FieldError>
        </div>
        <div>
          <label className="text-ink-secondary mb-1 block text-xs font-medium">Loại sản phẩm</label>
          <Select value={form.type} onValueChange={(value) => update("type", value as ProductType)}>
            <SelectTrigger size="default" aria-label="Loại sản phẩm" className={fieldClass()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                <SelectLabel>Loại sản phẩm</SelectLabel>
                <SelectItem value="Standard">Standard</SelectItem>
                <SelectItem value="Customizable">Customizable</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-ink-secondary mb-1 block text-xs font-medium">Tax class</label>
          <Select
            value={form.taxClass}
            onValueChange={(value) => update("taxClass", value as TaxClass)}
          >
            <SelectTrigger size="default" aria-label="Tax class" className={fieldClass()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                <SelectLabel>Tax class</SelectLabel>
                <SelectItem value="standard">standard</SelectItem>
                <SelectItem value="reduced">reduced</SelectItem>
                <SelectItem value="exempt">exempt</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-ink-secondary mb-1 block text-xs font-medium">UoM</label>
          <Select value={form.uom} onValueChange={(value) => update("uom", value as Uom)}>
            <SelectTrigger size="default" aria-label="UoM" className={fieldClass()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                <SelectLabel>UoM</SelectLabel>
                {(["pcs", "box", "kg", "m", "ream", "set"] satisfies Uom[]).map((uom) => (
                  <SelectItem key={uom} value={uom}>
                    {uom}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="lg:col-span-2">
          <label className="text-ink-secondary mb-1 block text-xs font-medium">Mô tả</label>
          <Textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
            placeholder="Mô tả nội bộ / catalog..."
            className={fieldClass()}
          />
        </div>
        <div className="lg:col-span-2">
          <label className="text-ink-secondary mb-1 block text-xs font-medium">
            Mô tả tiếng Anh
          </label>
          <Textarea
            value={form.descriptionEn}
            onChange={(e) => update("descriptionEn", e.target.value)}
            rows={3}
            placeholder="English description..."
            className={fieldClass()}
          />
        </div>
      </div>
    </Card>
  );
}

function VariantStep({
  attributes,
  form,
  update,
}: {
  attributes: ProductAttribute[];
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const toggleAttribute = (attributeId: string) => {
    const selected = form.selectedAttributeIds.includes(attributeId);
    update(
      "selectedAttributeIds",
      selected
        ? form.selectedAttributeIds.filter((id) => id !== attributeId)
        : [...form.selectedAttributeIds, attributeId],
    );
    if (selected) {
      const nextValues = { ...form.selectedValues };
      delete nextValues[attributeId];
      update("selectedValues", nextValues);
    }
  };

  const toggleValue = (attributeId: string, value: string) => {
    const current = form.selectedValues[attributeId] ?? [];
    update("selectedValues", {
      ...form.selectedValues,
      [attributeId]: current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    });
  };

  return (
    <Card>
      <SectionTitle
        title="Thuộc tính biến thể"
        description="Chọn các trục biến thể từ master data; hệ thống sẽ sinh ma trận SKU từ tổ hợp value."
      />
      <div className="mb-3 flex justify-end">
        <Link
          href={ADMIN_ROUTES.variants.list}
          className="text-accent text-[0.8125rem] font-medium hover:underline"
        >
          Quản lý thuộc tính biến thể →
        </Link>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {attributes.map((attr) => {
          const active = form.selectedAttributeIds.includes(attr.attributeId);
          const values = form.selectedValues[attr.attributeId] ?? [];
          return (
            <div
              key={attr.attributeId}
              className={cn(
                "rounded-[var(--r-sm)] border p-3",
                active ? "border-accent/40 bg-accent/5" : "border-border-default bg-bg-surface",
              )}
            >
              <label className="flex items-start gap-2">
                <Checkbox
                  checked={active}
                  onCheckedChange={() => toggleAttribute(attr.attributeId)}
                  className="mt-1"
                />
                <span className="min-w-0 flex-1">
                  <span className="text-ink-primary block font-medium">{attr.name.vi}</span>
                  <span className="text-ink-tertiary block text-xs">
                    {attr.name.en} · {attr.attributeId}
                  </span>
                </span>
              </label>
              {active && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {attr.values.map((value) => {
                    const checked = values.includes(value);
                    return (
                      <Button
                        key={value}
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => toggleValue(attr.attributeId, value)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors",
                          checked
                            ? "border-brand bg-brand/10 text-brand"
                            : "border-border-default bg-bg-subtle text-ink-secondary hover:bg-bg-muted",
                        )}
                      >
                        {attr.swatch?.[value] && (
                          <span
                            className="border-border-default size-2.5 rounded-full border"
                            style={{ backgroundColor: attr.swatch[value] }}
                          />
                        )}
                        {value}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SkuStep({
  form,
  update,
  skuRows,
  existingSkus,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  skuRows: SkuPreviewRow[];
  existingSkus: readonly Sku[];
}) {
  const existingSkuIds = new Set(existingSkus.map((sku) => sku.skuId));
  const duplicates = new Set<string>();
  const seen = new Set<string>();
  for (const row of skuRows.filter((r) => r.enabled)) {
    if (seen.has(row.skuCode) || existingSkuIds.has(row.skuCode)) duplicates.add(row.skuCode);
    seen.add(row.skuCode);
  }

  const columns: ColumnDef<SkuPreviewRow>[] = [
    {
      key: "enabled",
      header: "Dùng",
      cell: (row) => (
        <Checkbox
          checked={row.enabled}
          onCheckedChange={() =>
            update(
              "disabledSkuKeys",
              row.enabled
                ? [...form.disabledSkuKeys, row.key]
                : form.disabledSkuKeys.filter((key) => key !== row.key),
            )
          }
        />
      ),
    },
    {
      key: "skuCode",
      header: "SKU preview",
      cell: (row) => (
        <div>
          <Input
            value={row.skuCode}
            onChange={(e) =>
              update("skuOverrides", {
                ...form.skuOverrides,
                [row.key]: normalizeCode(e.target.value),
              })
            }
            className={cn(
              fieldClass(duplicates.has(row.skuCode)),
              "font-[family-name:var(--font-mono)]",
            )}
          />
          {duplicates.has(row.skuCode) && (
            <div className="text-danger mt-1 text-xs">SKU trùng trong matrix hoặc mock data.</div>
          )}
        </div>
      ),
    },
    {
      key: "variantLabel",
      header: "Tổ hợp",
      cell: (row) => (
        <span
          className={cn(
            "text-[0.8125rem]",
            row.enabled ? "text-ink-primary" : "text-ink-tertiary line-through",
          )}
        >
          {row.variantLabel}
        </span>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: () => <StatusDot domain="sku" status="Active" size="sm" />,
    },
    {
      key: "cost",
      header: "Giá vốn",
      align: "right",
      cell: (row) => (
        <Input
          value={form.skuCosts[row.key] ?? ""}
          onChange={(e) => update("skuCosts", { ...form.skuCosts, [row.key]: e.target.value })}
          inputMode="numeric"
          placeholder="85000"
          className={cn(
            fieldClass(),
            "w-[100px] text-right font-[family-name:var(--font-mono)] tabular-nums",
          )}
          disabled={!row.enabled}
        />
      ),
    },
  ];

  return (
    <Card>
      <SectionTitle
        title="Ma trận SKU"
        description="SKU được sinh tự động từ tổ hợp biến thể; người dùng chỉ bật/tắt tổ hợp hợp lệ và kiểm tra mã duy nhất."
      />
      <DataTable
        data={skuRows}
        columns={columns}
        rowKey={(row) => row.key}
        caption={`Có ${skuRows.filter((row) => row.enabled).length} / ${skuRows.length} SKU được bật`}
        flagRow={(row) => !row.enabled || duplicates.has(row.skuCode)}
        pageSize={12}
      />
    </Card>
  );
}

function LogisticsStep({
  form,
  update,
  showErrors,
  skuCount,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  showErrors: boolean;
  skuCount: number;
}) {
  return (
    <Card>
      <SectionTitle
        title="Thông số logistics"
        description={`Áp dụng làm default cho ${skuCount} SKU preview; dữ liệu này phục vụ Receipt, Slotting và Packing.`}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <label
            htmlFor="pc-kh-i-l-ng-kg"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            Khối lượng (kg) <span className="text-danger">*</span>
          </label>

          <Input
            id="pc-kh-i-l-ng-kg"
            value={form.weightKg}
            onChange={(e) => update("weightKg", e.target.value)}
            inputMode="decimal"
            placeholder="0.25"
            className={fieldClass(showErrors && !parsePositiveNumber(form.weightKg))}
          />
        </div>
        <div>
          <label htmlFor="pc-d-i-cm" className="text-ink-secondary mb-1 block text-xs font-medium">
            Dài (cm) <span className="text-danger">*</span>
          </label>

          <Input
            id="pc-d-i-cm"
            value={form.lengthCm}
            onChange={(e) => update("lengthCm", e.target.value)}
            inputMode="decimal"
            placeholder="30"
            className={fieldClass(showErrors && !parsePositiveNumber(form.lengthCm))}
          />
        </div>
        <div>
          <label htmlFor="pc-r-ng-cm" className="text-ink-secondary mb-1 block text-xs font-medium">
            Rộng (cm) <span className="text-danger">*</span>
          </label>

          <Input
            id="pc-r-ng-cm"
            value={form.widthCm}
            onChange={(e) => update("widthCm", e.target.value)}
            inputMode="decimal"
            placeholder="22"
            className={fieldClass(showErrors && !parsePositiveNumber(form.widthCm))}
          />
        </div>
        <div>
          <label htmlFor="pc-cao-cm" className="text-ink-secondary mb-1 block text-xs font-medium">
            Cao (cm) <span className="text-danger">*</span>
          </label>

          <Input
            id="pc-cao-cm"
            value={form.heightCm}
            onChange={(e) => update("heightCm", e.target.value)}
            inputMode="decimal"
            placeholder="2"
            className={fieldClass(showErrors && !parsePositiveNumber(form.heightCm))}
          />
        </div>
        <div>
          <label
            htmlFor="pc-pack-size"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            Pack size <span className="text-danger">*</span>
          </label>

          <Input
            id="pc-pack-size"
            value={form.packSize}
            onChange={(e) => update("packSize", e.target.value)}
            inputMode="numeric"
            placeholder="1"
            className={fieldClass(showErrors && !parsePositiveNumber(form.packSize))}
          />
        </div>
        <div>
          <label className="text-ink-secondary mb-1 block text-xs font-medium">UoM</label>
          <Select value={form.uom} onValueChange={(value) => update("uom", value as Uom)}>
            <SelectTrigger size="default" aria-label="UoM" className={fieldClass()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                <SelectLabel>UoM</SelectLabel>
                {(["pcs", "box", "kg", "m", "ream", "set"] satisfies Uom[]).map((uom) => (
                  <SelectItem key={uom} value={uom}>
                    {uom}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}

function InventoryStep({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <Card>
      <SectionTitle
        title="Kiểm soát tồn kho"
        description="Cấu hình batch/lot, hạn dùng, serial và ngưỡng bổ sung tồn cho SKU mới."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border-border-default bg-bg-subtle space-y-2 rounded-[var(--r-sm)] border p-3">
          {[
            ["lotTracking", "Theo dõi lô / batch"],
            ["serialTracking", "Theo dõi serial"],
            ["expiryTracking", "Theo dõi hạn dùng"],
          ].map(([key, label]) => (
            <label
              key={key}
              className="text-ink-secondary flex items-center gap-2 text-[0.8125rem]"
            >
              <Checkbox
                checked={Boolean(form[key as keyof FormState])}
                onCheckedChange={(checked) =>
                  update(key as keyof FormState, (checked === true) as never)
                }
              />
              {label}
            </label>
          ))}
          {form.expiryTracking && !form.lotTracking && (
            <div className="border-warning/30 bg-warning/10 text-warning rounded-[var(--r-sm)] border px-3 py-2 text-xs">
              Hàng có hạn dùng thường nên bật theo dõi lô để truy xuất nguồn gốc.
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="pc-reorder-point"
              className="text-ink-secondary mb-1 block text-xs font-medium"
            >
              Reorder point
            </label>

            <Input
              id="pc-reorder-point"
              value={form.reorderPoint}
              onChange={(e) => update("reorderPoint", e.target.value)}
              inputMode="numeric"
              placeholder="20"
              className={fieldClass(!parseNonNegativeNumber(form.reorderPoint))}
            />
          </div>
          <div>
            <label
              htmlFor="pc-t-n-t-i-a"
              className="text-ink-secondary mb-1 block text-xs font-medium"
            >
              Tồn tối đa
            </label>

            <Input
              id="pc-t-n-t-i-a"
              value={form.maxStock}
              onChange={(e) => update("maxStock", e.target.value)}
              inputMode="numeric"
              placeholder="200"
              className={fieldClass(!parseNonNegativeNumber(form.maxStock))}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function CustomizationStep({
  form,
  update,
  showErrors,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  showErrors: boolean;
}) {
  const addPrintArea = () => {
    update("printAreas", [
      ...form.printAreas,
      {
        id: `PA-${Date.now()}`,
        name: "Vùng in mới",
        position: "front",
        widthMm: "280",
        heightMm: "380",
        minDpi: "150",
      },
    ]);
  };

  const updatePrintArea = (id: string, patch: Partial<PrintAreaDraft>) => {
    update(
      "printAreas",
      form.printAreas.map((area) => (area.id === id ? { ...area, ...patch } : area)),
    );
  };

  if (form.type === "Standard") {
    return (
      <Card>
        <SectionTitle
          title="Tùy chỉnh"
          description="Sản phẩm Standard không yêu cầu print area hoặc template preview."
        />
        <div className="border-border-default bg-bg-subtle text-ink-secondary rounded-[var(--r-sm)] border px-4 py-6 text-center text-[0.8125rem]">
          Bước này được bỏ qua cho sản phẩm Standard.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle
        title="Cấu hình tùy chỉnh"
        description="Với sản phẩm in ấn, cần ít nhất một print area và template/model preview trước khi gửi duyệt."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label
            htmlFor="pc-template-2d"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            Template 2D
          </label>

          <Input
            id="pc-template-2d"
            value={form.templateName}
            onChange={(e) => update("templateName", e.target.value)}
            placeholder="template-tshirt-front.svg"
            className={fieldClass(
              showErrors && !form.templateName.trim() && !form.model3dUrl.trim(),
            )}
          />
        </div>
        <div>
          <label
            htmlFor="pc-model-3d"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            Model 3D
          </label>

          <Input
            id="pc-model-3d"
            value={form.model3dUrl}
            onChange={(e) => update("model3dUrl", e.target.value)}
            placeholder="/mock/3d/tshirt.glb"
            className={fieldClass(
              showErrors && !form.templateName.trim() && !form.model3dUrl.trim(),
            )}
          />
        </div>
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-ink-secondary block text-xs font-medium">
              Print areas <span className="text-danger">*</span>
            </label>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={addPrintArea}
              className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted rounded-[var(--r-sm)]"
            >
              <Plus className="size-3" /> Thêm vùng in
            </Button>
          </div>
          <div className="space-y-2">
            {form.printAreas.length === 0 && (
              <div
                className={cn(
                  "rounded-[var(--r-sm)] border px-4 py-6 text-center text-[0.8125rem]",
                  showErrors
                    ? "border-danger/30 bg-danger/5 text-danger"
                    : "border-border-default bg-bg-subtle text-ink-tertiary",
                )}
              >
                Chưa có print area.
              </div>
            )}
            {form.printAreas.map((area) => (
              <div
                key={area.id}
                className="border-border-default bg-bg-subtle grid gap-2 rounded-[var(--r-sm)] border p-3 md:grid-cols-[1fr_130px_100px_100px_80px_auto]"
              >
                <Input
                  value={area.name}
                  onChange={(e) => updatePrintArea(area.id, { name: e.target.value })}
                  className={fieldClass()}
                />
                <Select
                  value={area.position}
                  onValueChange={(value) =>
                    updatePrintArea(area.id, { position: value as PrintAreaDraft["position"] })
                  }
                >
                  <SelectTrigger
                    size="default"
                    aria-label="Vị trí print area"
                    className={fieldClass()}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectGroup>
                      <SelectLabel>Vị trí print area</SelectLabel>
                      {PRINT_POSITIONS.map((position) => (
                        <SelectItem key={position.value} value={position.value}>
                          {position.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input
                  value={area.widthMm}
                  onChange={(e) => updatePrintArea(area.id, { widthMm: e.target.value })}
                  placeholder="W mm"
                  className={fieldClass()}
                />
                <Input
                  value={area.heightMm}
                  onChange={(e) => updatePrintArea(area.id, { heightMm: e.target.value })}
                  placeholder="H mm"
                  className={fieldClass()}
                />
                <Input
                  value={area.minDpi}
                  onChange={(e) => updatePrintArea(area.id, { minDpi: e.target.value })}
                  placeholder="DPI"
                  className={fieldClass()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    update(
                      "printAreas",
                      form.printAreas.filter((item) => item.id !== area.id),
                    )
                  }
                  className="border-danger/30 text-danger hover:bg-danger/10 hover:text-danger rounded-[var(--r-sm)]"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          <label className="text-ink-secondary mb-2 block text-xs font-medium">
            Kỹ thuật in cho phép
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRINT_TECHNIQUES.map((technique) => {
              const active = form.allowedTechniques.includes(technique);
              return (
                <Button
                  key={technique}
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    update(
                      "allowedTechniques",
                      active
                        ? form.allowedTechniques.filter((t) => t !== technique)
                        : [...form.allowedTechniques, technique],
                    )
                  }
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    active
                      ? "border-brand bg-brand/10 text-brand hover:bg-brand/10 hover:text-brand"
                      : "border-border-default bg-bg-subtle text-ink-secondary hover:bg-bg-muted",
                  )}
                >
                  {technique}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

function CatalogStep({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <Card>
      <SectionTitle
        title="Dữ liệu TMĐT"
        description="Thông tin catalog có thể bổ sung sau; module này chỉ lưu mock và không publish thật."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className="text-ink-secondary mb-1 block text-xs font-medium">Ảnh mock URLs</label>
          <Textarea
            value={form.imageUrls}
            onChange={(e) => update("imageUrls", e.target.value)}
            rows={3}
            placeholder="/mock/img/new-1.jpg\n/mock/img/new-2.jpg"
            className={fieldClass()}
          />
        </div>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="pc-seo-title"
              className="text-ink-secondary mb-1 block text-xs font-medium"
            >
              SEO title
            </label>

            <Input
              id="pc-seo-title"
              value={form.seoTitle}
              onChange={(e) => update("seoTitle", e.target.value)}
              placeholder="Áo thun cotton in theo yêu cầu"
              className={fieldClass()}
            />
          </div>
          <div>
            <label className="text-ink-secondary flex items-center gap-2 text-[0.8125rem]">
              <Checkbox
                checked={form.catalogVisible}
                onCheckedChange={(checked) => update("catalogVisible", checked === true)}
              />
              Đánh dấu sẵn sàng hiển thị catalog sau khi Published
            </label>
          </div>
        </div>
        <div className="lg:col-span-2">
          <label className="text-ink-secondary mb-1 block text-xs font-medium">
            SEO description
          </label>
          <Textarea
            value={form.seoDescription}
            onChange={(e) => update("seoDescription", e.target.value)}
            rows={3}
            placeholder="Mô tả ngắn phục vụ catalog..."
            className={fieldClass()}
          />
        </div>
      </div>
    </Card>
  );
}

function ReviewStep({
  form,
  skuRows,
  issuesByStep,
  submitted,
  createdProductId,
  isSubmitting,
  onSubmit,
}: {
  form: FormState;
  skuRows: SkuPreviewRow[];
  issuesByStep: Map<StepKey, string[]>;
  submitted: boolean;
  createdProductId: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <SectionTitle
          title="Rà soát trước khi gửi duyệt"
          description="Tổng hợp dữ liệu chính và các lỗi còn chặn submit."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryItem label="Mã sản phẩm" value={form.productCode || "—"} mono />
          <SummaryItem label="Tên sản phẩm" value={form.name || "—"} />
          <SummaryItem label="Loại" value={form.type} />
          <SummaryItem label="Danh mục" value={form.categoryId || "—"} mono />
          <SummaryItem label="SKU được bật" value={String(skuRows.length)} mono />
          <SummaryItem
            label="SKU có giá vốn"
            value={`${Object.values(form.skuCosts).filter((v) => v.trim() !== "" && parsePositiveNumber(v)).length} / ${skuRows.length}`}
            mono
          />
        </div>
        <div className="border-border-default mt-5 rounded-[var(--r-sm)] border">
          {STEPS.map((step) => {
            const issues = issuesByStep.get(step.key) ?? [];
            const skipped = step.key === "customization" && form.type === "Standard";
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
                  <div className="text-ink-primary text-[0.8125rem] font-medium">
                    {step.label}
                    {skipped ? " · bỏ qua" : ""}
                  </div>
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
            <div className="mt-1">
              <StatusDot domain="product" status="Draft" withIcon />
            </div>
          </div>
          <Settings2 className="text-accent size-5" />
        </div>
        <p className="text-ink-secondary text-[0.8125rem] leading-relaxed">
          {submitted
            ? `Đã tạo bản nháp ${createdProductId ?? form.productCode}. Danh sách sản phẩm sẽ được làm mới qua React Query.`
            : "Tạo bản nháp sẽ gọi API Product qua mutation, giữ lỗi từ backend tại đúng field và không xoá dữ liệu đang nhập khi thất bại."}
        </p>
        <Button
          variant="default"
          type="button"
          size="sm"
          onClick={onSubmit}
          disabled={isSubmitting || submitted}
          className="bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse mt-4 w-full rounded-[var(--r-sm)]"
        >
          <Send className="size-3.5" />
          {isSubmitting ? "Đang tạo..." : submitted ? "Đã tạo bản nháp" : "Tạo bản nháp"}
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

function validateForm(
  form: FormState,
  selectedEntries: { attr: ProductAttribute; values: string[] }[],
  skuRows: SkuPreviewRow[],
  existingSkus: readonly Sku[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!form.name.trim()) issues.push({ step: "draft", message: "Tên sản phẩm là bắt buộc." });
  if (!form.productCode.trim())
    issues.push({ step: "draft", message: "Mã sản phẩm nội bộ là bắt buộc." });
  if (!form.categoryId) issues.push({ step: "draft", message: "Danh mục là bắt buộc." });
  if (!form.brand.trim()) issues.push({ step: "draft", message: "Thương hiệu là bắt buộc." });

  if (selectedEntries.length === 0)
    issues.push({ step: "variants", message: "Cần chọn ít nhất một thuộc tính biến thể." });
  for (const entry of selectedEntries) {
    if (entry.values.length === 0)
      issues.push({
        step: "variants",
        message: `${entry.attr.name.vi} cần chọn ít nhất một giá trị.`,
      });
  }

  const enabledRows = skuRows.filter((row) => row.enabled);
  if (enabledRows.length === 0)
    issues.push({ step: "sku", message: "Cần ít nhất một SKU được bật." });
  const existingSkuIds = new Set(existingSkus.map((sku) => sku.skuId));
  const seen = new Set<string>();
  for (const row of enabledRows) {
    if (!row.skuCode.trim()) issues.push({ step: "sku", message: "SKU code không được rỗng." });
    if (seen.has(row.skuCode) || existingSkuIds.has(row.skuCode))
      issues.push({ step: "sku", message: `SKU ${row.skuCode} bị trùng.` });
    seen.add(row.skuCode);
  }

  if (!parsePositiveNumber(form.weightKg))
    issues.push({ step: "logistics", message: "Khối lượng là bắt buộc và phải dương." });
  if (!parsePositiveNumber(form.lengthCm))
    issues.push({ step: "logistics", message: "Chiều dài là bắt buộc và phải dương." });
  if (!parsePositiveNumber(form.widthCm))
    issues.push({ step: "logistics", message: "Chiều rộng là bắt buộc và phải dương." });
  if (!parsePositiveNumber(form.heightCm))
    issues.push({ step: "logistics", message: "Chiều cao là bắt buộc và phải dương." });
  if (!parsePositiveNumber(form.packSize))
    issues.push({ step: "logistics", message: "Pack size là bắt buộc và phải dương." });

  if (!parseNonNegativeNumber(form.reorderPoint))
    issues.push({ step: "inventory", message: "Reorder point không được âm." });
  if (!parseNonNegativeNumber(form.maxStock))
    issues.push({ step: "inventory", message: "Tồn tối đa không được âm." });
  if (form.reorderPoint && form.maxStock && Number(form.reorderPoint) > Number(form.maxStock))
    issues.push({ step: "inventory", message: "Reorder point không được lớn hơn tồn tối đa." });

  if (form.type === "Customizable") {
    if (form.printAreas.length === 0)
      issues.push({
        step: "customization",
        message: "Sản phẩm Customizable cần ít nhất một print area.",
      });
    if (!form.templateName.trim() && !form.model3dUrl.trim())
      issues.push({
        step: "customization",
        message: "Cần template 2D hoặc model 3D cho sản phẩm Customizable.",
      });
    for (const area of form.printAreas) {
      if (
        !area.name.trim() ||
        !parsePositiveNumber(area.widthMm) ||
        !parsePositiveNumber(area.heightMm) ||
        !parsePositiveNumber(area.minDpi)
      ) {
        issues.push({
          step: "customization",
          message: "Print area cần tên, kích thước và DPI hợp lệ.",
        });
        break;
      }
    }
  }

  return issues;
}
