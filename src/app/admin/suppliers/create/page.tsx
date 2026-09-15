"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ClipboardCheck,
  Contact,
  FileText,
  Landmark,
  MapPin,
  Save,
  Send,
} from "lucide-react";
import { cn } from "cn";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/shared/Card";
import { StatusDot } from "@/components/shared/StatusDot";
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
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/components/shared/Toast";
import { suppliers, type Currency } from "@/lib/mock-data";

type StepKey = "profile" | "contact" | "address" | "terms" | "review";

interface StepDef {
  key: StepKey;
  label: string;
  icon: typeof Building2;
}

interface FormState {
  supplierId: string;
  name: string;
  taxCode: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  street: string;
  ward: string;
  district: string;
  province: string;
  postalCode: string;
  paymentTerms: string;
  currency: Currency;
  leadTimeDays: string;
  rating: string;
  active: boolean;
}

interface ValidationIssue {
  step: StepKey;
  message: string;
}

const STEPS: StepDef[] = [
  { key: "profile", label: "Hồ sơ NCC", icon: Building2 },
  { key: "contact", label: "Liên hệ", icon: Contact },
  { key: "address", label: "Địa chỉ", icon: MapPin },
  { key: "terms", label: "Điều khoản", icon: Landmark },
  { key: "review", label: "Gửi duyệt", icon: ClipboardCheck },
];

const INITIAL_FORM: FormState = {
  supplierId: "SUP-NEW",
  name: "",
  taxCode: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  street: "",
  ward: "",
  district: "",
  province: "",
  postalCode: "",
  paymentTerms: "Net 30",
  currency: "VND",
  leadTimeDays: "14",
  rating: "4.0",
  active: true,
};

function validateForm(form: FormState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const supplierId = form.supplierId.trim();
  const email = form.contactEmail.trim();
  const leadTime = Number(form.leadTimeDays);
  const rating = Number(form.rating);

  if (!supplierId) issues.push({ step: "profile", message: "Mã NCC là bắt buộc." });
  if (supplierId && suppliers.some((supplier) => supplier.supplierId === supplierId)) {
    issues.push({ step: "profile", message: "Mã NCC đã tồn tại trong mock data." });
  }
  if (!form.name.trim()) issues.push({ step: "profile", message: "Tên nhà cung cấp là bắt buộc." });
  if (!form.taxCode.trim()) issues.push({ step: "profile", message: "Mã số thuế là bắt buộc." });
  if (!form.contactName.trim())
    issues.push({ step: "contact", message: "Người liên hệ là bắt buộc." });
  if (!email) issues.push({ step: "contact", message: "Email liên hệ là bắt buộc." });
  if (email && !email.includes("@"))
    issues.push({ step: "contact", message: "Email liên hệ chưa đúng định dạng." });
  if (!form.contactPhone.trim())
    issues.push({ step: "contact", message: "Số điện thoại là bắt buộc." });
  if (!form.street.trim())
    issues.push({ step: "address", message: "Địa chỉ đường/số nhà là bắt buộc." });
  if (!form.ward.trim()) issues.push({ step: "address", message: "Phường/xã là bắt buộc." });
  if (!form.district.trim()) issues.push({ step: "address", message: "Quận/huyện là bắt buộc." });
  if (!form.province.trim()) issues.push({ step: "address", message: "Tỉnh/TP là bắt buộc." });
  if (!form.postalCode.trim())
    issues.push({ step: "address", message: "Mã bưu chính là bắt buộc." });
  if (!form.paymentTerms.trim())
    issues.push({ step: "terms", message: "Điều khoản thanh toán là bắt buộc." });
  if (!Number.isFinite(leadTime) || leadTime <= 0)
    issues.push({ step: "terms", message: "Lead time phải lớn hơn 0 ngày." });
  if (!Number.isFinite(rating) || rating < 0 || rating > 5)
    issues.push({ step: "terms", message: "Rating phải nằm trong khoảng 0–5." });

  return issues;
}

function FieldLabel({
  children,
  required = false,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="text-ink-secondary text-xs font-medium">
      {children} {required && <span className="text-danger">*</span>}
    </label>
  );
}

function TextInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={cn(
        "border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus-visible:border-brand focus-visible:ring-brand/20 h-9 rounded-[var(--r-sm)] text-[0.8125rem] shadow-none",
        className,
      )}
    />
  );
}

function SelectInput({
  label,
  value,
  onValueChange,
  children,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        size="default"
        aria-label={label}
        className="border-border-default bg-bg-surface text-ink-primary focus-visible:border-brand focus-visible:ring-brand/20 h-9 w-full rounded-[var(--r-sm)] text-[0.8125rem] shadow-none"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        <SelectGroup>
          <SelectLabel>{label}</SelectLabel>
          {children}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-border-default flex items-start justify-between gap-4 border-b py-2 last:border-b-0">
      <span className="text-ink-tertiary text-xs">{label}</span>
      <span className="text-ink-primary text-right text-[0.8125rem] font-medium">{value}</span>
    </div>
  );
}

export default function CreateSupplierPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [currentStep, setCurrentStep] = useState<StepKey>("profile");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const issues = useMemo(() => validateForm(form), [form]);
  const issuesByStep = useMemo(() => {
    const map = new Map<StepKey, string[]>();
    for (const issue of issues) {
      map.set(issue.step, [...(map.get(issue.step) ?? []), issue.message]);
    }
    return map;
  }, [issues]);

  const currentIndex = STEPS.findIndex((step) => step.key === currentStep);
  const currentStepIssues = issuesByStep.get(currentStep) ?? [];

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const stepStatus = (step: StepKey): "active" | "done" | "error" | "idle" => {
    if (submitAttempted && issuesByStep.has(step)) return "error";
    if (step === currentStep) return "active";
    const index = STEPS.findIndex((item) => item.key === step);
    return index < currentIndex ? "done" : "idle";
  };

  const goNext = () => {
    if (currentIndex < STEPS.length - 1) setCurrentStep(STEPS[currentIndex + 1]!.key);
  };

  const goBack = () => {
    if (currentIndex > 0) setCurrentStep(STEPS[currentIndex - 1]!.key);
  };

  const saveDraft = () => {
    toast.success("Đã lưu nháp", "Hồ sơ nhà cung cấp được giữ trong UI mock.");
  };

  const handleSubmitAttempt = () => {
    setSubmitAttempted(true);
    if (issues.length > 0) {
      setCurrentStep(issues[0]!.step);
      toast.error("Chưa thể gửi duyệt", issues[0]!.message);
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmSubmit = () => {
    setSubmitted(true);
    setConfirmOpen(false);
    setCurrentStep("review");
    toast.success("Đã gửi hồ sơ NCC", "Nhà cung cấp mock đã vào hàng chờ duyệt.");
  };

  const status = submitted ? "Pending Approval" : "Draft";

  return (
    <>
      <PageHeader
        title="Tạo nhà cung cấp"
        subtitle="Tạo hồ sơ NCC dùng cho Replenishment, Purchase Order và Supplier Invoice."
        actions={
          <Link
            href="/admin/suppliers"
            className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Quay lại
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
        <Card className="h-fit p-0">
          <div className="border-border-default border-b px-4 py-3">
            <div className="text-ink-tertiary text-xs">Trạng thái hồ sơ</div>
            <div className="mt-2">
              <StatusDot domain="po" status={status} withIcon />
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
                    status === "error" &&
                      "border-danger/30 bg-danger/5 text-danger border font-medium",
                  )}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-current text-[0.6875rem]">
                    {status === "done" ? <Check className="size-3" /> : index + 1}
                  </span>
                  <Icon className="size-3.5 shrink-0" />
                  <span className="flex-1 truncate">{step.label}</span>
                </Button>
              );
            })}
          </div>
        </Card>

        <div className="min-w-0 space-y-4 pb-24">
          {submitAttempted && currentStepIssues.length > 0 && (
            <div className="border-danger/30 bg-danger/5 text-danger rounded-[var(--r-sm)] border px-4 py-3 text-[0.8125rem]">
              <div className="font-medium">Cần bổ sung trước khi gửi duyệt</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {currentStepIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {currentStep === "profile" && (
            <Card>
              <h2 className="text-ink-primary flex items-center gap-2 text-sm font-semibold">
                <Building2 className="text-accent size-4" />
                Hồ sơ nhà cung cấp
              </h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel required>Mã NCC</FieldLabel>
                  <TextInput
                    value={form.supplierId}
                    onChange={(e) => updateForm("supplierId", e.target.value)}
                    placeholder="SUP-NEW"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Mã số thuế</FieldLabel>
                  <TextInput
                    value={form.taxCode}
                    onChange={(e) => updateForm("taxCode", e.target.value)}
                    placeholder="0301234567"
                  />
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <FieldLabel required>Tên nhà cung cấp</FieldLabel>
                  <TextInput
                    value={form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                    placeholder="Công ty TNHH..."
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Trạng thái</FieldLabel>
                  <SelectInput
                    label="Trạng thái"
                    value={form.active ? "active" : "inactive"}
                    onValueChange={(value) => updateForm("active", value === "active")}
                  >
                    <SelectItem value="active">Đang hoạt động</SelectItem>
                    <SelectItem value="inactive">Tạm ngưng</SelectItem>
                  </SelectInput>
                </div>
              </div>
            </Card>
          )}

          {currentStep === "contact" && (
            <Card>
              <h2 className="text-ink-primary flex items-center gap-2 text-sm font-semibold">
                <Contact className="text-accent size-4" />
                Thông tin liên hệ
              </h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel required>Người liên hệ</FieldLabel>
                  <TextInput
                    value={form.contactName}
                    onChange={(e) => updateForm("contactName", e.target.value)}
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Số điện thoại</FieldLabel>
                  <TextInput
                    value={form.contactPhone}
                    onChange={(e) => updateForm("contactPhone", e.target.value)}
                    placeholder="+84..."
                  />
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <FieldLabel required>Email</FieldLabel>
                  <TextInput
                    value={form.contactEmail}
                    onChange={(e) => updateForm("contactEmail", e.target.value)}
                    placeholder="sales@example.com"
                  />
                </div>
              </div>
            </Card>
          )}

          {currentStep === "address" && (
            <Card>
              <h2 className="text-ink-primary flex items-center gap-2 text-sm font-semibold">
                <MapPin className="text-accent size-4" />
                Địa chỉ NCC
              </h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-1.5 lg:col-span-2">
                  <FieldLabel required>Đường / số nhà</FieldLabel>
                  <TextInput
                    value={form.street}
                    onChange={(e) => updateForm("street", e.target.value)}
                    placeholder="Số nhà, đường, KCN..."
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Phường / xã</FieldLabel>
                  <TextInput
                    value={form.ward}
                    onChange={(e) => updateForm("ward", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Quận / huyện</FieldLabel>
                  <TextInput
                    value={form.district}
                    onChange={(e) => updateForm("district", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Tỉnh / TP</FieldLabel>
                  <TextInput
                    value={form.province}
                    onChange={(e) => updateForm("province", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Mã bưu chính</FieldLabel>
                  <TextInput
                    value={form.postalCode}
                    onChange={(e) => updateForm("postalCode", e.target.value)}
                  />
                </div>
              </div>
            </Card>
          )}

          {currentStep === "terms" && (
            <Card>
              <h2 className="text-ink-primary flex items-center gap-2 text-sm font-semibold">
                <Landmark className="text-accent size-4" />
                Điều khoản thương mại
              </h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel required>Điều khoản thanh toán</FieldLabel>
                  <TextInput
                    value={form.paymentTerms}
                    onChange={(e) => updateForm("paymentTerms", e.target.value)}
                    placeholder="Net 30"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Tiền tệ PO</FieldLabel>
                  <SelectInput
                    label="Tiền tệ PO"
                    value={form.currency}
                    onValueChange={(value) => updateForm("currency", value as Currency)}
                  >
                    <SelectItem value="VND">VND</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                  </SelectInput>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Lead time chuẩn</FieldLabel>
                  <TextInput
                    type="number"
                    min="1"
                    value={form.leadTimeDays}
                    onChange={(e) => updateForm("leadTimeDays", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Rating chất lượng</FieldLabel>
                  <TextInput
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={form.rating}
                    onChange={(e) => updateForm("rating", e.target.value)}
                  />
                </div>
              </div>
            </Card>
          )}

          {currentStep === "review" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <h2 className="text-ink-primary flex items-center gap-2 text-sm font-semibold">
                  <FileText className="text-accent size-4" />
                  Review hồ sơ
                </h2>
                <div className="divide-border-default mt-4 divide-y">
                  <InfoRow label="Mã NCC" value={form.supplierId || "—"} />
                  <InfoRow label="Tên NCC" value={form.name || "—"} />
                  <InfoRow label="MST" value={form.taxCode || "—"} />
                  <InfoRow label="Liên hệ" value={form.contactName || "—"} />
                  <InfoRow label="Email" value={form.contactEmail || "—"} />
                  <InfoRow label="Điện thoại" value={form.contactPhone || "—"} />
                  <InfoRow label="Điều khoản" value={form.paymentTerms || "—"} />
                  <InfoRow label="Tiền tệ" value={form.currency} />
                  <InfoRow label="Lead time" value={`${form.leadTimeDays || "—"} ngày`} />
                  <InfoRow label="Rating" value={form.rating || "—"} />
                </div>
              </Card>
              <Card>
                <h2 className="text-ink-primary text-sm font-semibold">Checklist gửi duyệt</h2>
                <div className="mt-4 space-y-2">
                  {[
                    ["Hồ sơ định danh", !issuesByStep.has("profile")],
                    ["Thông tin liên hệ", !issuesByStep.has("contact")],
                    ["Địa chỉ giao dịch", !issuesByStep.has("address")],
                    ["Điều khoản thương mại", !issuesByStep.has("terms")],
                  ].map(([label, ok]) => (
                    <div
                      key={label as string}
                      className="border-border-default bg-bg-subtle flex items-center justify-between rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem]"
                    >
                      <span className="text-ink-secondary">{label}</span>
                      <span
                        className={ok ? "text-positive font-medium" : "text-danger font-medium"}
                      >
                        {ok ? "Đạt" : "Thiếu"}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      <div className="border-border-default bg-bg-surface/95 fixed right-0 bottom-0 left-0 z-40 border-t px-4 py-3 backdrop-blur lg:left-[240px]">
        <div className="flex items-center justify-between gap-3">
          <div className="text-ink-tertiary text-xs">
            Bước {currentIndex + 1}/{STEPS.length} · {STEPS[currentIndex]!.label}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={saveDraft}
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
              disabled={currentIndex === 0}
              className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45"
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
        title="Gửi duyệt nhà cung cấp"
        description={`Hồ sơ ${form.supplierId || "NCC mới"} sẽ chuyển sang trạng thái Pending Approval trong UI mock.`}
        confirmLabel="Gửi duyệt"
        onConfirm={handleConfirmSubmit}
      />
    </>
  );
}
