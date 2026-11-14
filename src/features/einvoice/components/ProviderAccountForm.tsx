"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PROVIDER_ENVIRONMENTS } from "@/constants/einvoice";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { einvoiceErrorMessage } from "../errors";
import { providerAccountInputSchema } from "../input-schemas";
import { useStoreProviderAccount } from "../mutations";

import type { z } from "zod";
import type { EInvoiceProvider, ProviderAccountInput } from "../types";

type Values = z.input<typeof providerAccountInputSchema>;
const ENV_LABEL = { SANDBOX: "Thử nghiệm (sandbox)", PRODUCTION: "Thật (production)" } as const;

/**
 * Tài khoản gọi nhà cung cấp (docs 21 BR-10): môi trường, tên đăng nhập, mật khẩu. Mật khẩu chỉ gửi đi,
 * không bao giờ đọc lại; bỏ trống = giữ mật khẩu đã lưu.
 */
export function ProviderAccountForm({ provider }: { provider: EInvoiceProvider }) {
  const [error, setError] = useState<string | null>(null);
  const store = useStoreProviderAccount();
  const form = useForm<Values, unknown, ProviderAccountInput>({
    resolver: zodResolver(providerAccountInputSchema),
    defaultValues: {
      environment: provider.environment === "PRODUCTION" ? "PRODUCTION" : "SANDBOX",
      username: provider.username ?? "",
      secret: "",
    },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((values) => {
    setError(null);
    store.mutate(
      { provider: provider.provider, version: provider.version, ...values },
      {
        onSuccess: () => form.resetField("secret"),
        onError: (failure) => setError(einvoiceErrorMessage(failure)),
      },
    );
  });
  const id = (name: string) => `account-${provider.provider}-${name}`;

  return (
    <form className="grid gap-3 md:grid-cols-3" onSubmit={(event) => void submit(event)}>
      <FormField id={id("env")} label="Môi trường" required>
        <Controller
          control={form.control}
          name="environment"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id={id("env")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_ENVIRONMENTS.map((env) => (
                  <SelectItem key={env} value={env}>
                    {ENV_LABEL[env]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>
      <FormField id={id("user")} label="Tài khoản" required error={errors.username?.message}>
        <Input
          autoComplete="off"
          {...fieldA11y(id("user"), errors.username?.message)}
          {...form.register("username")}
        />
      </FormField>
      <FormField
        id={id("secret")}
        label={provider.secretSet ? "Mật khẩu mới (bỏ trống = giữ)" : "Mật khẩu"}
      >
        <Input
          type="password"
          autoComplete="new-password"
          {...fieldA11y(id("secret"), undefined)}
          {...form.register("secret")}
        />
      </FormField>
      <div className="flex items-center gap-3 md:col-span-3">
        <Button type="submit" size="sm" disabled={store.isPending}>
          Lưu tài khoản
        </Button>
        <span className="text-ink-tertiary text-xs">
          {provider.secretSet ? "Đã lưu mật khẩu — không hiển thị lại." : "Chưa lưu mật khẩu."}
        </span>
        {error && (
          <span role="alert" className="text-danger text-[0.8125rem]">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
