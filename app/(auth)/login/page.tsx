import { LoginMockCard } from "@/features/auth/components/LoginMockCard.client";
import { siteConfig } from "@/config/site";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <LoginMockCard />
      <p className="mt-8 text-xs text-slate-400">
        © {new Date().getFullYear()} {siteConfig.companyName}
      </p>
    </div>
  );
}
