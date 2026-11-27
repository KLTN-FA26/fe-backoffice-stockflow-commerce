/**
 * Test render helper — wraps components in all required providers
 * (QueryClient + ThemeProvider, như root layout).
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import React from "react";

import { makeQueryClient } from "@/lib/api/query-client";

import { ThemeProvider } from "@/components/theme-provider";

function AllProviders({ children }: { children: React.ReactNode }) {
  const queryClient = makeQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}
