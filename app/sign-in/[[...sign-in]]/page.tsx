import Link from "next/link";
import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { AuthSplitShell } from "@/features/auth/components/AuthSplitShell";
import { AuthFormHeading } from "@/features/auth/components/AuthFormUi";
import styles from "@/features/auth/components/auth.module.css";
import { ClerkMountGate } from "@/features/auth/components/ClerkMountGate.client";
import {
  clerkConfigured,
  clerkLoginEnabled,
  clerkRoutes,
} from "@/lib/auth/clerk";
import { routes } from "@/config/routes";

export default function ClerkSignInPage() {
  if (!clerkConfigured()) {
    return (
      <AuthSplitShell
        topRight={{ label: "Inicio", href: routes.home }}
        caption={{
          title: "Tu publicidad, en un solo lugar.",
          sub: "Accede a tus cuentas y sigue el movimiento de tu inversión.",
        }}
      >
        <AuthFormHeading title="Inicia sesión">
          Continúa a la página de acceso para ingresar con tu correo.
        </AuthFormHeading>
        <Link
          href={routes.login}
          className={styles.secondaryButton}
        >
          Ir al inicio de sesión
        </Link>
      </AuthSplitShell>
    );
  }

  // Prod sin satélite DNS/env → OTP (evita pantalla en blanco + clerk.impoerp.com).
  if (!clerkLoginEnabled()) {
    redirect(routes.login);
  }

  return (
    <AuthSplitShell
      topRight={{ label: "Inicio", href: routes.home }}
      caption={{
        title: "Tu publicidad, en un solo lugar.",
        sub: "Accede a tus cuentas y sigue el movimiento de tu inversión.",
      }}
    >
      <ClerkMountGate>
        <SignIn
          routing="path"
          path={clerkRoutes.signIn}
          signUpUrl={clerkRoutes.signUp}
          forceRedirectUrl={clerkRoutes.complete}
          fallbackRedirectUrl={clerkRoutes.complete}
        />
      </ClerkMountGate>
    </AuthSplitShell>
  );
}
