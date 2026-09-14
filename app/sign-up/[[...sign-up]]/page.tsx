import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { AuthSplitShell } from "@/features/auth/components/AuthSplitShell";
import { AuthFormHeading } from "@/features/auth/components/AuthFormUi";
import styles from "@/features/auth/components/auth.module.css";
import { ClerkMountGate } from "@/features/auth/components/ClerkMountGate.client";
import { clerkConfigured, clerkLoginEnabled, clerkRoutes } from "@/lib/auth/clerk";
import { routes } from "@/config/routes";

export default function ClerkSignUpPage() {
  if (!clerkConfigured()) {
    return (
      <AuthSplitShell
        topRight={{ label: "Iniciar sesión", href: routes.login }}
        caption={{
          title: "Una sola cartera para todas tus cuentas.",
          sub: "Organiza tu inversión publicitaria con Ads Holistic.",
        }}
      >
        <AuthFormHeading title="Crea tu cuenta">
          Para continuar con el registro, vuelve a la página de acceso.
        </AuthFormHeading>
        <Link
          href={routes.login}
          className={styles.secondaryButton}
        >
          Ir a la página de acceso
        </Link>
      </AuthSplitShell>
    );
  }

  if (!clerkLoginEnabled()) {
    redirect(routes.login);
  }

  return (
    <AuthSplitShell
      topRight={{ label: "Ya tengo cuenta", href: clerkRoutes.signIn }}
      caption={{
        title: "Una sola cartera para todas tus cuentas.",
        sub: "Organiza tu inversión publicitaria con Ads Holistic.",
      }}
    >
      <ClerkMountGate>
        <SignUp
          routing="path"
          path={clerkRoutes.signUp}
          signInUrl={clerkRoutes.signIn}
          forceRedirectUrl={clerkRoutes.complete}
          fallbackRedirectUrl={clerkRoutes.complete}
        />
      </ClerkMountGate>
    </AuthSplitShell>
  );
}
