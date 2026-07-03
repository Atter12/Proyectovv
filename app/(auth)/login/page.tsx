import { Suspense } from "react";
import { LoginMockCard } from "@/features/auth/components/LoginMockCard.client";
import { siteConfig } from "@/config/site";

function LoginCardFallback() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-8 shadow-sm">
      <div className="mx-auto h-12 w-12 animate-pulse rounded-xl bg-slate-200" />
      <div className="mx-auto mt-4 h-5 w-40 animate-pulse rounded bg-slate-200" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-slate-50 px-4 py-8 sm:px-6">
      <Suspense fallback={<LoginCardFallback />}>
        <LoginMockCard />
      </Suspense>
      <p className="mt-8 text-xs text-slate-400">
        © {new Date().getFullYear()} {siteConfig.companyName}
      </p>
    </div>
  );
}
