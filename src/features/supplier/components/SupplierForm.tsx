"use client";

import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Building2, Contact, MapPin, Landmark, Save } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { PageHeader } from "@/components/shared/PageHeader";
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
import { supplierCreateInputSchema } from "@/features/supplier/schemas";
import { useCreateSupplier, useUpdateSupplier } from "@/features/supplier/mutations";
import type { SupplierCreateInput, SupplierDto } from "@/features/supplier/types";

/* ── Helpers ─────────────────────────────────────────────────────────── */

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-ink-secondary text-xs font-medium">
      {children} {required && <span className="text-danger">*</span>}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-danger mt-1 text-xs">{message}</p>;
}

/* ── Props ────────────────────────────────────────────────────────────── */

interface SupplierFormProps {
  /** When passed, form operates in edit mode. */
  existingSupplier?: SupplierDto;
}

/* ── Component ────────────────────────────────────────────────────────── */

export function SupplierForm({ existingSupplier }: SupplierFormProps) {
  const router = useRouter();
  const isEdit = Boolean(existingSupplier);
  const { mutate: createSupplier, isPending: isCreating } = useCreateSupplier();
  const { mutate: updateSupplier, isPending: isUpdating } = useUpdateSupplier();
  const isPending = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors },
  } = useForm<SupplierCreateInput>({
    resolver: zodResolver(supplierCreateInputSchema),
    defaultValues: isEdit
      ? {
          name: existingSupplier!.name,
          taxCode: existingSupplier!.taxCode,
          contactName: existingSupplier!.contactName,
          contactEmail: existingSupplier!.contactEmail,
          contactPhone: existingSupplier!.contactPhone,
          address: existingSupplier!.address,
          paymentTerms: existingSupplier!.paymentTerms,
          currency: existingSupplier!.currency,
          leadTimeDays: existingSupplier!.leadTimeDays,
        }
      : {
          name: "",
          taxCode: "",
          contactName: "",
          contactEmail: "",
          contactPhone: "",
          address: {
            street: "",
            ward: "",
            district: "",
            province: "",
            postalCode: "",
            country: "VN",
          },
          paymentTerms: "Net 30",
          currency: "VND",
          leadTimeDays: 14,
        },
  });

  const currency = useWatch({ control, name: "currency" });

  const onSubmit = (data: SupplierCreateInput) => {
    if (isEdit && existingSupplier) {
      updateSupplier(
        { ...data, id: existingSupplier.supplierId },
        {
          onSuccess: () => router.push(`${ADMIN_ROUTES.suppliers}/${existingSupplier.supplierId}`),
        },
      );
    } else {
      createSupplier(data, {
        onSuccess: (created) => router.push(`${ADMIN_ROUTES.suppliers}/${created.supplierId}`),
        onError: (err) => {
          if (err.fieldErrors) {
            for (const [field, message] of Object.entries(err.fieldErrors)) {
              setError(field as keyof SupplierCreateInput, {
                type: "server",
                message,
              });
            }
          }
        },
      });
    }
  };

  const inputCls =
    "border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus-visible:border-brand focus-visible:ring-brand/20 h-9 rounded-[var(--r-sm)] text-[0.8125rem] shadow-none";

  return (
    <>
      <PageHeader
        title={isEdit ? `Chỉnh sửa NCC — ${existingSupplier?.name}` : "Tạo nhà cung cấp mới"}
        subtitle="Điền đầy đủ thông tin hồ sơ nhà cung cấp."
        actions={
          <Button size="sm" variant="outline" onClick={() => router.push(ADMIN_ROUTES.suppliers)}>
            <ArrowLeft size={16} className="mr-1" />
            Danh sách
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
        {/* ── Section 1: Profile ─────────────────────────────────────────────── */}
        <section className="bg-bg-surface border-border-default rounded-[var(--r-sm)] border p-4">
          <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-sm font-semibold">
            <Building2 size={16} /> Hồ sơ nhà cung cấp
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label required>Tên nhà cung cấp</Label>
              <Input {...register("name")} placeholder="Tên công ty" className={inputCls} />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="space-y-1">
              <Label required>Mã số thuế</Label>
              <Input {...register("taxCode")} placeholder="0123456789" className={inputCls} />
              <FieldError message={errors.taxCode?.message} />
            </div>
          </div>
        </section>

        {/* ── Section 2: Contact ─────────────────────────────────────────────── */}
        <section className="bg-bg-surface border-border-default rounded-[var(--r-sm)] border p-4">
          <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-sm font-semibold">
            <Contact size={16} /> Liên hệ
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label required>Người liên hệ</Label>
              <Input {...register("contactName")} placeholder="Họ tên" className={inputCls} />
              <FieldError message={errors.contactName?.message} />
            </div>
            <div className="space-y-1">
              <Label required>Số điện thoại</Label>
              <Input
                {...register("contactPhone")}
                placeholder="0912 345 678"
                className={inputCls}
              />
              <FieldError message={errors.contactPhone?.message} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label required>Email</Label>
              <Input
                {...register("contactEmail")}
                type="email"
                placeholder="email@congty.vn"
                className={inputCls}
              />
              <FieldError message={errors.contactEmail?.message} />
            </div>
          </div>
        </section>

        {/* ── Section 3: Address ─────────────────────────────────────────────── */}
        <section className="bg-bg-surface border-border-default rounded-[var(--r-sm)] border p-4">
          <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-sm font-semibold">
            <MapPin size={16} /> Địa chỉ (VN)
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label required>Số nhà / Đường</Label>
              <Input
                {...register("address.street")}
                placeholder="123 Nguyễn Huệ"
                className={inputCls}
              />
              <FieldError message={errors.address?.street?.message} />
            </div>
            <div className="space-y-1">
              <Label required>Phường / Xã</Label>
              <Input {...register("address.ward")} placeholder="Bến Nghé" className={inputCls} />
              <FieldError message={errors.address?.ward?.message} />
            </div>
            <div className="space-y-1">
              <Label required>Quận / Huyện</Label>
              <Input {...register("address.district")} placeholder="Quận 1" className={inputCls} />
              <FieldError message={errors.address?.district?.message} />
            </div>
            <div className="space-y-1">
              <Label required>Tỉnh / TP</Label>
              <Input
                {...register("address.province")}
                placeholder="TP. Hồ Chí Minh"
                className={inputCls}
              />
              <FieldError message={errors.address?.province?.message} />
            </div>
            <div className="space-y-1">
              <Label required>Mã bưu chính</Label>
              <Input
                {...register("address.postalCode")}
                placeholder="700000"
                className={inputCls}
              />
              <FieldError message={errors.address?.postalCode?.message} />
            </div>
          </div>
        </section>

        {/* ── Section 4: Terms ────────────────────────────────────────────────── */}
        <section className="bg-bg-surface border-border-default rounded-[var(--r-sm)] border p-4">
          <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-sm font-semibold">
            <Landmark size={16} /> Điều khoản &amp; lead time
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label required>Điều khoản thanh toán</Label>
              <Input {...register("paymentTerms")} placeholder="Net 30" className={inputCls} />
              <FieldError message={errors.paymentTerms?.message} />
            </div>
            <div className="space-y-1">
              <Label required>Lead time (ngày)</Label>
              <Input
                type="number"
                {...register("leadTimeDays", { valueAsNumber: true })}
                min={0}
                className={inputCls}
              />
              <FieldError message={errors.leadTimeDays?.message} />
            </div>
            <div className="space-y-1">
              <Label>Đơn vị tiền tệ</Label>
              <Select
                value={currency}
                onValueChange={(v) => setValue("currency", v as "VND" | "USD")}
              >
                <SelectTrigger aria-label="Tiền tệ" className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Tiền tệ</SelectLabel>
                    <SelectItem value="VND">VND — Việt Nam Đồng</SelectItem>
                    <SelectItem value="USD">USD — US Dollar</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* ── Actions ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(ADMIN_ROUTES.suppliers)}
            disabled={isPending}
          >
            Hủy
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            <Save size={16} className="mr-1" />
            {isPending ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo nhà cung cấp"}
          </Button>
        </div>
      </form>
    </>
  );
}
