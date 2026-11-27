import { Suspense } from "react";

import { LoginPage, LoginPageFallback } from "@/lib/auth/components/login/LoginPage";

/** `useSearchParams` (callbackUrl) cần Suspense boundary. */
export default function Page() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPage />
    </Suspense>
  );
}
